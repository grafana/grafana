import { type RefCallback } from 'react';
import { act, getWrapper, render, screen, userEvent } from 'test/test-utils';

import { usePluginComponent } from '@grafana/runtime';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';
import { configureStore } from 'app/store/configureStore';

import { FullscreenWorkspaceShell } from './FullscreenWorkspaceShell';

interface PluginWorkspaceProps {
  workspaceHostRef?: RefCallback<HTMLDivElement>;
  onExitFullscreenWorkspace?: () => void;
  topBarActionsRef?: RefCallback<HTMLDivElement>;
}

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponent: jest.fn(),
}));

const usePluginComponentMock = jest.mocked(usePluginComponent);

function renderShell(
  workspaceHostRef: RefCallback<HTMLDivElement> = jest.fn(),
  store?: ReturnType<typeof configureStore>
) {
  const chrome = new AppChromeService();
  const wrapper = getWrapper({ grafanaContext: { chrome }, store });
  return { chrome, ...render(<FullscreenWorkspaceShell workspaceHostRef={workspaceHostRef} />, { wrapper }) };
}

/** Stands in for the plugin header, which exposes a slot for core to portal into. */
function mockPluginWorkspaceWithTopBarSlot() {
  const seenRefs: Array<RefCallback<HTMLDivElement> | undefined> = [];
  const PluginWorkspace = ({ topBarActionsRef }: PluginWorkspaceProps) => {
    seenRefs.push(topBarActionsRef);
    return <div data-testid="top-bar-actions" ref={topBarActionsRef} />;
  };
  usePluginComponentMock.mockReturnValue({
    component: PluginWorkspace,
    isLoading: false,
  } as unknown as ReturnType<typeof usePluginComponent>);
  return seenRefs;
}

/** The profile menu is driven by the `profile` nav node, which the default test store lacks. */
function storeWithProfileNav() {
  return configureStore({
    navIndex: {
      profile: {
        id: 'profile',
        text: 'Test User',
        url: '/profile',
        children: [{ id: 'profile-settings', text: 'Profile settings', url: '/profile' }],
      },
    },
  });
}

describe('FullscreenWorkspaceShell', () => {
  // Entering the workspace navigates (it pushes the entry Back pops), so every enter
  // below triggers a React update and needs `act`.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a loading indicator while the plugin component is loading', () => {
    usePluginComponentMock.mockReturnValue({
      component: null,
      isLoading: true,
    } as unknown as ReturnType<typeof usePluginComponent>);

    renderShell();

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('renders an error when no plugin component is available', () => {
    usePluginComponentMock.mockReturnValue({
      component: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof usePluginComponent>);

    const { chrome } = renderShell();
    act(() => chrome.setFullscreenWorkspace({ fullscreenWorkspace: true }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Workspace unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();

    // The primary action exits workspace mode without a reload.
    screen.getByRole('button', { name: 'Exit workspace' }).click();
    expect(chrome.state.getValue().fullscreenWorkspace).toBe(false);
  });

  it('renders the plugin workspace and wires the platform host and exit callback', () => {
    const workspaceHostRef = jest.fn();
    const PluginWorkspace = jest.fn(({ workspaceHostRef, onExitFullscreenWorkspace }: PluginWorkspaceProps) => {
      // Surface the props so the test can assert they were passed through.
      workspaceHostRef?.(null);
      return (
        <button type="button" data-testid="plugin-workspace" onClick={onExitFullscreenWorkspace}>
          workspace
        </button>
      );
    });
    usePluginComponentMock.mockReturnValue({
      component: PluginWorkspace,
      isLoading: false,
    } as unknown as ReturnType<typeof usePluginComponent>);

    const { chrome } = renderShell(workspaceHostRef);
    act(() => chrome.setFullscreenWorkspace({ fullscreenWorkspace: true }));

    expect(screen.getByTestId('plugin-workspace')).toBeInTheDocument();
    expect(workspaceHostRef).toHaveBeenCalledWith(null);

    screen.getByTestId('plugin-workspace').click();
    expect(chrome.state.getValue().fullscreenWorkspace).toBe(false);
  });

  it('portals the profile menu into the slot the plugin header exposes', async () => {
    mockPluginWorkspaceWithTopBarSlot();

    const { chrome } = renderShell(jest.fn(), storeWithProfileNav());
    act(() => chrome.setFullscreenWorkspace({ fullscreenWorkspace: true }));

    const profile = await screen.findByRole('button', { name: 'Profile' });
    expect(screen.getByTestId('top-bar-actions')).toContainElement(profile);
  });

  describe('leaving the workspace for a portaled link', () => {
    // These menu items are real anchors; jsdom can't navigate and logs an error when it tries.
    const swallowNavigation = (event: MouseEvent) => event.preventDefault();
    beforeEach(() => document.addEventListener('click', swallowNavigation));
    afterEach(() => document.removeEventListener('click', swallowNavigation));

    it('exits when a profile menu link is followed', async () => {
      mockPluginWorkspaceWithTopBarSlot();

      const { chrome } = renderShell(jest.fn(), storeWithProfileNav());
      act(() => chrome.setFullscreenWorkspace({ fullscreenWorkspace: true }));

      await userEvent.click(await screen.findByRole('button', { name: 'Profile' }));
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Profile settings' }));

      // Otherwise the destination would open inside the workspace's Platform tab.
      expect(chrome.state.getValue().fullscreenWorkspace).toBe(false);
    });

    it('stays in the workspace for items that open a drawer in place', async () => {
      mockPluginWorkspaceWithTopBarSlot();

      const { chrome } = renderShell(jest.fn(), storeWithProfileNav());
      act(() => chrome.setFullscreenWorkspace({ fullscreenWorkspace: true }));

      await userEvent.click(await screen.findByRole('button', { name: 'Profile' }));
      await userEvent.click(await screen.findByRole('menuitem', { name: /change theme/i }));

      expect(chrome.state.getValue().fullscreenWorkspace).toBe(true);
    });
  });

  it('claims no top bar slot when there is no profile nav node, so no divider is drawn', () => {
    const seenRefs = mockPluginWorkspaceWithTopBarSlot();

    const { chrome } = renderShell();
    act(() => chrome.setFullscreenWorkspace({ fullscreenWorkspace: true }));

    expect(seenRefs.every((ref) => ref === undefined)).toBe(true);
    expect(screen.queryByRole('button', { name: 'Profile' })).not.toBeInTheDocument();
  });

  it('renders an error when the plugin workspace throws', () => {
    const PluginWorkspace = () => {
      throw new Error('workspace boom');
    };
    usePluginComponentMock.mockReturnValue({
      component: PluginWorkspace,
      isLoading: false,
    } as unknown as ReturnType<typeof usePluginComponent>);
    // React logs caught errors via console.error; silence it so jest-fail-on-console passes.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { chrome } = renderShell();
    act(() => chrome.setFullscreenWorkspace({ fullscreenWorkspace: true }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Workspace unavailable')).toBeInTheDocument();

    screen.getByRole('button', { name: 'Exit workspace' }).click();
    expect(chrome.state.getValue().fullscreenWorkspace).toBe(false);

    consoleError.mockRestore();
  });
});
