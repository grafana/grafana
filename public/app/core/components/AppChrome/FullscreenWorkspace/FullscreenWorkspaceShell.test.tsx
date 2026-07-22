import { type RefCallback } from 'react';
import { getWrapper, render, screen } from 'test/test-utils';

import { usePluginComponent } from '@grafana/runtime';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';

import { FullscreenWorkspaceShell } from './FullscreenWorkspaceShell';

interface PluginWorkspaceProps {
  workspaceHostRef?: RefCallback<HTMLDivElement>;
  onExitFullscreenWorkspace?: () => void;
}

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponent: jest.fn(),
}));

const usePluginComponentMock = jest.mocked(usePluginComponent);

function renderShell(workspaceHostRef: RefCallback<HTMLDivElement> = jest.fn()) {
  const chrome = new AppChromeService();
  const wrapper = getWrapper({ grafanaContext: { chrome } });
  return { chrome, ...render(<FullscreenWorkspaceShell workspaceHostRef={workspaceHostRef} />, { wrapper }) };
}

describe('FullscreenWorkspaceShell', () => {
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
    chrome.setFullscreenWorkspace(true);

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
    chrome.setFullscreenWorkspace(true);

    expect(screen.getByTestId('plugin-workspace')).toBeInTheDocument();
    expect(workspaceHostRef).toHaveBeenCalledWith(null);

    screen.getByTestId('plugin-workspace').click();
    expect(chrome.state.getValue().fullscreenWorkspace).toBe(false);
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
    chrome.setFullscreenWorkspace(true);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Workspace unavailable')).toBeInTheDocument();

    screen.getByRole('button', { name: 'Exit workspace' }).click();
    expect(chrome.state.getValue().fullscreenWorkspace).toBe(false);

    consoleError.mockRestore();
  });
});
