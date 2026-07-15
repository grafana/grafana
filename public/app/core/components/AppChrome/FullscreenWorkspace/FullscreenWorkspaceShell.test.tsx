import { type RefCallback } from 'react';

import { usePluginComponent } from '@grafana/runtime';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';
import { getWrapper, render, screen } from 'test/test-utils';

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

  it('renders nothing while the plugin component is loading', () => {
    usePluginComponentMock.mockReturnValue({
      component: null,
      isLoading: true,
    } as unknown as ReturnType<typeof usePluginComponent>);

    const { container } = renderShell();

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no plugin component is available', () => {
    usePluginComponentMock.mockReturnValue({
      component: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof usePluginComponent>);

    const { container } = renderShell();

    expect(container).toBeEmptyDOMElement();
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
});
