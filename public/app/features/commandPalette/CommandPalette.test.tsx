import { KBarProvider } from 'kbar';
import { act, render, screen, userEvent } from 'test/test-utils';

import { useAssistant } from '@grafana/assistant';
import { reportInteraction, setBackendSrv, setPluginLinksHook } from '@grafana/runtime';
import {
  setGetObservablePluginLinks,
  useFlagDashboardVectorSearch,
  useFlagGrafanaVectorSearchCmdk,
} from '@grafana/runtime/internal';
import { getVectorSearchHandler } from '@grafana/test-utils/handlers';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { getObservablePluginLinks } from '../plugins/extensions/getPluginExtensions';

import { CommandPalette } from './CommandPalette';

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
  OpenAssistantButton: jest.fn().mockImplementation(({ title }) => <button>{title}</button>),
}));

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useFlagDashboardVectorSearch: jest.fn(),
  useFlagGrafanaVectorSearchCmdk: jest.fn(),
}));

jest.mock('kbar', () => ({
  ...jest.requireActual('kbar'),
  KBarPortal: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  KBarAnimator: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
}));

const setup = () => {
  return render(
    <KBarProvider>
      <CommandPalette />
    </KBarProvider>
  );
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
    // Deep search is gated on both vector-search toggles; default them on so most
    // tests exercise the deep column, overridden where needed
    (useFlagDashboardVectorSearch as jest.Mock).mockReturnValue(true);
    (useFlagGrafanaVectorSearchCmdk as jest.Mock).mockReturnValue(true);
    (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: true });
    (reportInteraction as jest.Mock).mockClear();
  });

  it('should render empty state with AI Assistant button when no results and assistant is available', async () => {
    (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: true });
    setup();
    await triggerEmptyState();

    // The empty state now waits for the deep search fetch (500ms debounce) to settle
    expect(await screen.findByText('No results found', {}, { timeout: 3000 })).toBeInTheDocument();
    // Check if AI Assistant button is rendered with correct props
    expect(screen.getByRole('button', { name: 'Search with Grafana Assistant' })).toBeInTheDocument();
  });

  it('should render empty state without AI Assistant button when assistant is not available', async () => {
    // The assistant button is independent of deep search — it stays gated on assistant availability
    (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: false });
    setup();
    await triggerEmptyState();

    // Check if empty state message is rendered
    expect(await screen.findByText('No results found', {}, { timeout: 3000 })).toBeInTheDocument();
    // Check that AI Assistant button is not rendered
    expect(screen.queryByRole('button', { name: 'Search with Grafana Assistant' })).not.toBeInTheDocument();
  });

  describe('deep search column', () => {
    afterEach(() => {
      server.events.removeAllListeners();
    });

    it('shows grouped deep search results when the feature toggle is enabled', async () => {
      server.use(
        getVectorSearchHandler([
          { name: 'dash-1', title: 'API latency', snippet: 'p99 latency by region', score: 0.1 },
          { name: 'dash-1', title: 'API latency', snippet: 'p50 latency', score: 0.2 },
        ])
      );

      setup();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'latency');

      expect(await screen.findByText('Dashboards deep search')).toBeInTheDocument();
      // Deep search debounces for 500ms, so allow extra time for results
      expect(await screen.findByText('API latency', {}, { timeout: 3000 })).toBeInTheDocument();
      expect(screen.getByText('p99 latency by region')).toBeInTheDocument();
      // Each snippet line is prefixed with its score
      expect(screen.getByText('0.10')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /API latency/ })).toHaveAttribute('href', '/d/dash-1');
    });

    it('renders dashboard tags from the snippet as pills', async () => {
      server.use(
        getVectorSearchHandler([
          {
            name: 'dash-1',
            title: 'API latency',
            snippet: 'p99 latency by region\nTags: infra, prod',
            score: 0.1,
          },
        ])
      );

      setup();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'latency');

      expect(await screen.findByText('API latency', {}, { timeout: 3000 })).toBeInTheDocument();
      // Tags surface as pills, not as raw "Tags:" text in the snippet
      expect(screen.getByText('infra')).toBeInTheDocument();
      expect(screen.getByText('prod')).toBeInTheDocument();
      expect(screen.queryByText(/Tags:/)).not.toBeInTheDocument();
    });

    it('caps visible snippets and shows a "more matched panels" line', async () => {
      server.use(
        getVectorSearchHandler([
          // Equal scores so all five survive the cutoff; only MAX_SNIPPETS_PER_DASHBOARD (3) show
          { name: 'dash-1', title: 'API latency', snippet: 'panel one', score: 0.1 },
          { name: 'dash-1', title: 'API latency', snippet: 'panel two', score: 0.1 },
          { name: 'dash-1', title: 'API latency', snippet: 'panel three', score: 0.1 },
          { name: 'dash-1', title: 'API latency', snippet: 'panel four', score: 0.1 },
          { name: 'dash-1', title: 'API latency', snippet: 'panel five', score: 0.1 },
        ])
      );

      setup();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'latency');

      expect(await screen.findByText('panel one', {}, { timeout: 3000 })).toBeInTheDocument();
      expect(screen.getByText('panel three')).toBeInTheDocument();
      // The 4th and 5th collapse into the count
      expect(screen.queryByText('panel four')).not.toBeInTheDocument();
      expect(screen.getByText('2 more matched panels')).toBeInTheDocument();
    });

    it('hides the empty state when only deep search has results', async () => {
      server.use(
        getVectorSearchHandler([{ name: 'dash-1', title: 'API latency', snippet: 'p99 latency', score: 0.1 }])
      );

      setup();
      const user = userEvent.setup();
      // A query that matches no keyword results but returns deep search hits
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'zzznomatch');

      expect(await screen.findByText('API latency', {}, { timeout: 3000 })).toBeInTheDocument();
      expect(screen.queryByText('No results found')).not.toBeInTheDocument();
    });

    it('supports keyboard navigation into and out of the deep search column', async () => {
      server.use(
        getVectorSearchHandler([
          // Equal scores so both dashboards survive the average filter
          { name: 'dash-1', title: 'API latency', snippet: 'p99 latency', score: 0.1 },
          { name: 'dash-2', title: 'Checkout', snippet: 'checkout errors', score: 0.1 },
        ])
      );

      setup();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText('Search or jump to...');
      // No keyword results match this query, so the deep column is the only pane
      await user.type(input, 'latency');
      await screen.findByText('API latency', {}, { timeout: 3000 });

      // Arrow down from the input moves focus into the results
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('link', { name: /API latency/ })).toHaveFocus();

      // Down/Up move between cards
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('link', { name: /Checkout/ })).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(screen.getByRole('link', { name: /API latency/ })).toHaveFocus();

      // Up past the first item returns focus to the input
      await user.keyboard('{ArrowUp}');
      expect(input).toHaveFocus();
    });

    it('moves focus between the keyword and deep search panes', async () => {
      server.use(
        getVectorSearchHandler([{ name: 'dash-1', title: 'Dark dashboards', snippet: 'dark mode panels', score: 0.1 }])
      );

      setup();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText('Search or jump to...');
      // "dark" matches the static change-theme action, so the keyword pane has results
      await user.type(input, 'dark');
      await screen.findByText('Dark dashboards', {}, { timeout: 3000 });

      // Arrow down from the input lands on the keyword list
      await user.keyboard('{ArrowDown}');
      const keywordList = screen.getByTestId('command-palette-keyword-results');
      expect(keywordList).toHaveFocus();

      // Left from the leftmost pane is a no-op — focus must NOT fall back to
      // the input (kbar's focus guard would otherwise steal it)
      await user.keyboard('{ArrowLeft}');
      expect(keywordList).toHaveFocus();

      // Right moves to the deep search pane, left moves back
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('link', { name: /Dark dashboards/ })).toHaveFocus();
      // Right from the rightmost pane is a no-op as well
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('link', { name: /Dark dashboards/ })).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(keywordList).toHaveFocus();

      // Up past the first keyword item returns focus to the input
      await user.keyboard('{ArrowUp}');
      expect(input).toHaveFocus();
    });

    it('escape in the results returns focus to the input without closing the palette', async () => {
      server.use(
        getVectorSearchHandler([{ name: 'dash-1', title: 'API latency', snippet: 'p99 latency', score: 0.1 }])
      );

      setup();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText('Search or jump to...');
      await user.type(input, 'latency');
      await screen.findByText('API latency', {}, { timeout: 3000 });

      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('link', { name: /API latency/ })).toHaveFocus();

      await user.keyboard('{Escape}');
      expect(input).toHaveFocus();
      // The palette is still open
      expect(screen.getByPlaceholderText('Search or jump to...')).toBeInTheDocument();
    });

    it.each([
      ['dashboardVectorSearch off', () => (useFlagDashboardVectorSearch as jest.Mock).mockReturnValue(false)],
      ['vectorSearchCmdk off', () => (useFlagGrafanaVectorSearchCmdk as jest.Mock).mockReturnValue(false)],
    ])('does not render the deep search column when %s (both flags required)', async (_label, disableFlag) => {
      disableFlag();
      let deepSearchCalled = false;
      server.events.on('request:start', ({ request }) => {
        if (request.url.includes('/search/vector')) {
          deepSearchCalled = true;
        }
      });

      setup();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'latency');

      expect(screen.queryByText('Dashboards deep search')).not.toBeInTheDocument();
      // Outwait the 500ms deep search debounce to prove no request fires
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
      });
      expect(deepSearchCalled).toBe(false);
      expect(screen.queryByText('Dashboards deep search')).not.toBeInTheDocument();
    });
  });

  describe('command_palette_action_selected analytics', () => {
    afterEach(() => {
      server.events.removeAllListeners();
    });

    it('reports deep-search context when a deep search result is clicked', async () => {
      // The deep card is a real <a href>, so clicking it makes jsdom log an
      // (unimplemented) navigation error — suppress it; we only care about the report
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      server.use(
        getVectorSearchHandler([
          { name: 'dash-1', title: 'API latency', snippet: 'panel one', score: 0.1 },
          { name: 'dash-2', title: 'Checkout', snippet: 'panel two', score: 0.1 },
        ])
      );

      setup();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'latency');

      const link = await screen.findByRole('link', { name: /API latency/ }, { timeout: 3000 });
      await user.click(link);

      expect(reportInteraction).toHaveBeenCalledWith(
        'command_palette_action_selected',
        expect.objectContaining({
          actionName: 'API latency',
          index: 0,
          section: 'deep-search',
          isDeepSearchAction: true,
          isDeepSearchEnabled: true,
          isDeepSearchLoaded: true,
          deepSearchItemsCount: 2,
          itemsCount: expect.any(Number),
        })
      );
      consoleErrorSpy.mockRestore();
    });

    it('reports a non-deep-search selection when a keyword result is selected', async () => {
      server.use(getVectorSearchHandler([{ name: 'dash-1', title: 'API latency', snippet: 'panel one', score: 0.1 }]));

      setup();
      const user = userEvent.setup();
      // "dark" matches the static change-theme action (a command, not a link, so no navigation)
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'dark');
      const options = await screen.findAllByRole('option', {}, { timeout: 3000 });
      await user.click(options[0]);

      expect(reportInteraction).toHaveBeenCalledWith(
        'command_palette_action_selected',
        expect.objectContaining({
          isDeepSearchAction: false,
          index: expect.any(Number),
          // Stable slug, not the translated section header ("Preferences")
          section: 'preferences',
          itemsCount: expect.any(Number),
        })
      );
    });
  });

  describe('keyboard model', () => {
    it('uses the legacy model (auto-selects an item) when deep search is disabled', async () => {
      // Either flag off → deepSearchEnabled is false → legacy keyboard handling
      (useFlagGrafanaVectorSearchCmdk as jest.Mock).mockReturnValue(false);

      setup();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText('Search or jump to...');
      await user.type(input, 'dark');
      await screen.findAllByRole('option', {}, { timeout: 3000 });

      // Legacy behavior: an item is preselected, so the input points at it
      expect(input).toHaveAttribute('aria-activedescendant');
    });

    it('uses the new model (nothing preselected) when deep search is enabled', async () => {
      // Both flags default to true in beforeEach → new keyboard handling
      setup();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText('Search or jump to...');
      await user.type(input, 'dark');
      await screen.findAllByRole('option', {}, { timeout: 3000 });

      // New behavior: focus starts in the input, nothing is highlighted
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });
  });
});
