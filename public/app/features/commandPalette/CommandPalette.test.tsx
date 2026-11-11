import { KBarPortal, KBarProvider, useKBar } from 'kbar';
import { HttpResponse, http } from 'msw';
import { act, render, screen, userEvent, waitFor } from 'test/test-utils';

import { OpenAssistantButton, useAssistant } from '@grafana/assistant';
import { PluginExtensionTypes } from '@grafana/data';
import { reportInteraction, setBackendSrv, setPluginLinksHook } from '@grafana/runtime';
import { setGetObservablePluginLinks } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/feature-flags';
import { setupMockServer } from '@grafana/test-utils/server';
import { PortalContainer } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { getObservablePluginLinks } from '../plugins/extensions/getPluginExtensions';

import { CommandPalette } from './CommandPalette';
import { type CommandPaletteAction } from './types';

setPluginLinksHook(() => ({
  links: [],
  isLoading: false,
}));
setGetObservablePluginLinks(getObservablePluginLinks);

setBackendSrv(backendSrv);
const server = setupMockServer();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(),
  OpenAssistantButton: jest.fn().mockImplementation(({ title, onClick }) => <button onClick={onClick}>{title}</button>),
}));

jest.mock('kbar', () => ({
  ...jest.requireActual('kbar'),
  KBarPortal: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  KBarAnimator: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
}));

// jsdom has no layout, so the real virtualizer renders an arbitrary few-row window and rows
// later in the list (e.g. notebook results, which come last) are only sometimes in the DOM.
jest.mock('react-virtual', () => ({
  useVirtual: ({ size }: { size: number }) => ({
    virtualItems: Array.from({ length: size }, (_, index) => ({
      index,
      start: index * 50,
      measureRef: jest.fn(),
    })),
    totalSize: size * 50,
    scrollToIndex: jest.fn(),
  }),
}));

const setup = () => {
  return render(
    <KBarProvider>
      <CommandPalette />
    </KBarProvider>
  );
};

// Window listeners run after the palette's own click handling, so this reads whether the palette cancelled the
// link's navigation, then cancels it itself because jsdom can't navigate.
const isNavigationCancelledOnClick = async (element: Element) => {
  let cancelled: boolean | undefined;
  const recordAndCancel = (event: MouseEvent) => {
    cancelled = event.defaultPrevented;
    event.preventDefault();
  };
  window.addEventListener('click', recordAndCancel);
  await userEvent.click(element);
  window.removeEventListener('click', recordAndCancel);
  return cancelled;
};

const triggerEmptyState = async () => {
  const user = userEvent.setup();
  // Type a nonsense query to trigger the empty state naturally, rather than relying on
  // kbar's useThrottledValue timing with an empty search (which causes flakiness)
  const input = screen.getByPlaceholderText('Search or jump to...');
  await user.type(input, 'zzznomatch');
};

describe('CommandPalette', () => {
  beforeEach(() => {
    setTestFlags({ 'dashboard.notebooks': false, 'grafana.cmdkHybridSearch': false });
    jest.mocked(KBarPortal).mockImplementation(({ children }) => <div>{children}</div>);
    setPluginLinksHook(() => ({
      links: [],
      isLoading: false,
    }));

    (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: true });
    (reportInteraction as jest.Mock).mockClear();
  });

  it('mounts the palette in the shared overlay container when opened', async () => {
    jest
      .mocked(KBarPortal)
      .mockImplementation(jest.requireActual<{ KBarPortal: typeof KBarPortal }>('kbar').KBarPortal);

    function OpenPalette() {
      const { query } = useKBar();
      return <button onClick={() => query.toggle()}>Open command palette</button>;
    }

    const { user } = render(
      <>
        <PortalContainer />
        <KBarProvider>
          <OpenPalette />
          <CommandPalette />
        </KBarProvider>
      </>
    );

    await user.click(screen.getByRole('button', { name: 'Open command palette' }));

    const input = await screen.findByRole('combobox');
    const overlayContainer = document.getElementById('grafana-portal-container');
    expect(overlayContainer).toContainElement(input);
  });

  it('reevaluates extension links each time the palette opens', async () => {
    let isPaletteOpen = false;
    let isExtensionEnabled = false;
    const pluginLinksHook = jest.fn(() => ({
      links: isExtensionEnabled
        ? [
            {
              id: 'test-plugin/command-palette-link',
              type: PluginExtensionTypes.link as const,
              title: 'Dynamic extension action',
              description: 'Enabled after the palette first opens',
              pluginId: 'test-plugin',
              path: '/test-plugin',
            },
          ]
        : [],
      isLoading: false,
    }));
    setPluginLinksHook(pluginLinksHook);
    jest.mocked(KBarPortal).mockImplementation(({ children }) => (isPaletteOpen ? <div>{children}</div> : null));

    const view = setup();
    expect(pluginLinksHook).not.toHaveBeenCalled();

    isPaletteOpen = true;
    await act(async () => {
      view.rerender(
        <KBarProvider>
          <CommandPalette />
        </KBarProvider>
      );
    });
    await screen.findByPlaceholderText('Search or jump to...');
    const callsAfterFirstOpen = pluginLinksHook.mock.calls.length;
    expect(callsAfterFirstOpen).toBeGreaterThan(0);
    expect(screen.queryByText('Dynamic extension action')).not.toBeInTheDocument();

    isPaletteOpen = false;
    await act(async () => {
      view.rerender(
        <KBarProvider>
          <CommandPalette />
        </KBarProvider>
      );
    });

    isExtensionEnabled = true;
    isPaletteOpen = true;
    await act(async () => {
      view.rerender(
        <KBarProvider>
          <CommandPalette />
        </KBarProvider>
      );
    });

    expect(pluginLinksHook.mock.calls.length).toBeGreaterThan(callsAfterFirstOpen);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Search or jump to...'), 'Dynamic extension action');
    expect(await screen.findByText('Dynamic extension action')).toBeInTheDocument();
  });

  it('lets a path-only extension link navigate to its path when selected', async () => {
    setPluginLinksHook(() => ({
      links: [
        {
          id: 'test-plugin/path-only-link',
          type: PluginExtensionTypes.link as const,
          title: 'Path-only extension link',
          description: 'Has a path and no onClick',
          pluginId: 'test-plugin',
          path: '/a/test-plugin/page',
        },
      ],
      isLoading: false,
    }));
    setup();

    await userEvent.type(screen.getByPlaceholderText('Search or jump to...'), 'Path-only extension link');
    const row = (await screen.findByText('Path-only extension link')).closest('a');

    expect(row).toHaveAttribute('href', '/a/test-plugin/page');
    expect(await isNavigationCancelledOnClick(row!)).toBe(false);
  });

  it('calls onClick instead of navigating when an extension link has one', async () => {
    const onClick = jest.fn();
    setPluginLinksHook(() => ({
      links: [
        {
          id: 'test-plugin/onclick-link',
          type: PluginExtensionTypes.link as const,
          title: 'Click handler extension link',
          description: 'Has both a path and an onClick',
          pluginId: 'test-plugin',
          path: '/a/test-plugin/page',
          onClick,
        },
      ],
      isLoading: false,
    }));
    setup();

    await userEvent.type(screen.getByPlaceholderText('Search or jump to...'), 'Click handler extension link');
    const row = (await screen.findByText('Click handler extension link')).closest('a');

    expect(await isNavigationCancelledOnClick(row!)).toBe(true);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  describe('notebook results', () => {
    // contextSrv.user is a mutable singleton, so these are restored even when an assertion throws —
    // otherwise a failure here leaks a signed-in user with notebooks:read into every later test.
    const originalPermissions = contextSrv.user.permissions;
    const originalIsSignedIn = contextSrv.user.isSignedIn;

    beforeEach(() => {
      contextSrv.user.permissions = { [AccessControlAction.NotebooksRead]: true };
      contextSrv.user.isSignedIn = true;
      setTestFlags({ 'dashboard.notebooks': true });
    });

    afterEach(() => {
      contextSrv.user.permissions = originalPermissions;
      contextSrv.user.isSignedIn = originalIsSignedIn;
    });

    it('shows notebook search results alongside other palette actions', async () => {
      server.use(
        http.post('*/apis/dashboard.grafana.app/v2beta1/namespaces/default/notebooks/search', () =>
          HttpResponse.json({
            items: [
              {
                resource: { group: 'dashboard.grafana.app', resource: 'notebooks', kind: 'Notebook', name: 'nb1' },
                fields: { title: 'Incident latency notes' },
              },
            ],
          })
        )
      );

      setup();
      await userEvent.setup().type(screen.getByPlaceholderText('Search or jump to...'), 'Incident');

      expect(await screen.findByRole('option', { name: 'Notebooks: Incident latency notes' })).toHaveAttribute(
        'href',
        expect.stringContaining('/notebooks/nb1')
      );
    });
  });

  it('should render empty state with AI Assistant button when no results and assistant is available', async () => {
    (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: true });
    setup();
    await triggerEmptyState();

    expect(await screen.findByText('No results found', {}, { timeout: 3000 })).toBeInTheDocument();
    // Check if AI Assistant button is rendered with correct props
    expect(screen.getByRole('button', { name: 'Search with Grafana Assistant' })).toBeInTheDocument();
  });

  it('should render empty state without AI Assistant button when assistant is not available', async () => {
    (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: false });
    setup();
    await triggerEmptyState();

    // Check if empty state message is rendered
    expect(await screen.findByText('No results found', {}, { timeout: 3000 })).toBeInTheDocument();
    // Check that AI Assistant button is not rendered
    expect(screen.queryByRole('button', { name: 'Search with Grafana Assistant' })).not.toBeInTheDocument();
  });

  describe('command_palette_action_selected analytics', () => {
    afterEach(() => {
      server.events.removeAllListeners();
    });

    it('reports the destination url as target when a navigational keyword result is clicked', async () => {
      // Clicking the row's real <a href> makes jsdom log an (unimplemented)
      // navigation error — suppress it; we only care about the report
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const actions: CommandPaletteAction[] = [
        {
          id: 'test/latency-dashboard',
          name: 'Latency overview',
          section: 'Dashboards',
          sectionId: 'dashboards',
          priority: 1,
          url: '/d/abc123',
        },
      ];
      render(
        <KBarProvider actions={actions}>
          <CommandPalette />
        </KBarProvider>
      );
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'Latency overview');

      const option = await screen.findByRole('option', { name: /Latency overview/ }, { timeout: 3000 });
      await user.click(option);

      expect(reportInteraction).toHaveBeenCalledWith(
        'command_palette_action_selected',
        expect.objectContaining({
          actionId: 'test/latency-dashboard',
          section: 'dashboards',
          target: '/d/abc123',
        })
      );
      consoleErrorSpy.mockRestore();
    });

    it('reports the section and item count when a keyword result is selected', async () => {
      setup();
      const user = userEvent.setup();
      // "dark" matches the static change-theme action (a command, not a link, so no navigation)
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'dark');
      await user.click(await screen.findByRole('option', { name: /^Preferences: Change theme/ }, { timeout: 3000 }));

      expect(reportInteraction).toHaveBeenCalledWith(
        'command_palette_action_selected',
        expect.objectContaining({
          index: expect.any(Number),
          // Stable slug, not the translated section header ("Preferences")
          section: 'preferences',
          itemsCount: expect.any(Number),
          // Change theme executes in place — no destination to report
          target: undefined,
        })
      );
    });
  });

  describe('ask assistant', () => {
    beforeEach(() => {
      setTestFlags({ 'grafana.cmdkHybridSearch': true });
    });

    it('opens the assistant with the search query on Shift+Enter', async () => {
      const openAssistant = jest.fn();
      (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: true, openAssistant });

      setup();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'latency');
      await user.keyboard('{Shift>}{Enter}{/Shift}');

      expect(openAssistant).toHaveBeenCalledWith({
        origin: 'grafana/command-palette',
        prompt: 'Search for latency',
      });
      expect(reportInteraction).toHaveBeenCalledWith('command_palette_ask_assistant', { trigger: 'shortcut' });
    });

    it('opens the assistant from the input pill', async () => {
      const openAssistant = jest.fn();
      (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: true, openAssistant });

      setup();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'latency');
      await user.click(screen.getByRole('button', { name: /ask Assistant/ }));

      // The real OpenAssistantButton opens the assistant itself (mocked here), so assert it got the right props
      expect((OpenAssistantButton as jest.Mock).mock.lastCall?.[0]).toMatchObject({
        origin: 'grafana/command-palette',
        prompt: 'Search for latency',
      });
      expect(reportInteraction).toHaveBeenCalledWith('command_palette_ask_assistant', { trigger: 'input-pill' });
    });

    it('does not show the pill or react to Shift+Enter when the assistant is not available', async () => {
      (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: false });

      setup();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'latency');

      expect(screen.queryByRole('button', { name: /ask Assistant/ })).not.toBeInTheDocument();
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      expect(reportInteraction).not.toHaveBeenCalledWith('command_palette_ask_assistant', expect.anything());
    });

    it('does not show the pill or react to Shift+Enter when the search query is empty', async () => {
      const openAssistant = jest.fn();
      (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: true, openAssistant });

      setup();
      const user = userEvent.setup();
      // Focus the input without typing anything
      screen.getByPlaceholderText('Search or jump to...').focus();

      expect(screen.queryByRole('button', { name: /ask Assistant/ })).not.toBeInTheDocument();
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      expect(openAssistant).not.toHaveBeenCalled();
    });

    it('does not show the pill or react to Shift+Enter when hybrid search is disabled', async () => {
      setTestFlags({ 'grafana.cmdkHybridSearch': false });
      const openAssistant = jest.fn();
      (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: true, openAssistant });

      setup();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'latency');

      expect(screen.queryByRole('button', { name: /ask Assistant/ })).not.toBeInTheDocument();
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      expect(openAssistant).not.toHaveBeenCalled();
    });
  });

  describe('keyboard model', () => {
    it.each([false, true])(
      'selects and activates items with hybrid search enabled: %s',
      async (hybridSearchEnabled) => {
        setTestFlags({ 'grafana.cmdkHybridSearch': hybridSearchEnabled });
        const performFirstAction = jest.fn();
        const performSecondAction = jest.fn();
        render(
          <KBarProvider
            actions={[
              { id: 'keyboard-first', name: 'zzkeyboard first', perform: performFirstAction },
              { id: 'keyboard-second', name: 'zzkeyboard second', perform: performSecondAction },
            ]}
          >
            <CommandPalette />
          </KBarProvider>
        );
        const user = userEvent.setup();
        const input = screen.getByPlaceholderText('Search or jump to...');
        await user.type(input, 'zzkeyboard');
        // Dashboard search results arriving later reset the selection to the first item
        await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading bar' })).not.toBeInTheDocument());
        const firstOption = await screen.findByRole('option', { name: 'zzkeyboard first' });
        const secondOption = screen.getByRole('option', { name: 'zzkeyboard second' });

        expect(firstOption).toHaveAttribute('aria-selected', 'true');
        expect(input).toHaveAttribute('aria-activedescendant', firstOption.id);

        await user.keyboard('{ArrowDown}');
        expect(secondOption).toHaveAttribute('aria-selected', 'true');
        await user.keyboard('{ArrowUp}');
        expect(firstOption).toHaveAttribute('aria-selected', 'true');

        await user.keyboard('{Control>}n{/Control}');
        expect(secondOption).toHaveAttribute('aria-selected', 'true');
        await user.keyboard('{Control>}p{/Control}');
        expect(firstOption).toHaveAttribute('aria-selected', 'true');

        await user.keyboard('{Enter}');
        expect(performFirstAction).toHaveBeenCalledTimes(1);
        expect(performSecondAction).not.toHaveBeenCalled();
      }
    );
  });
});
