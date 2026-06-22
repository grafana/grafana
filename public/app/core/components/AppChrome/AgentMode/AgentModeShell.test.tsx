import { render, screen } from '@testing-library/react';
import { type RefCallback } from 'react';

import { usePluginComponent } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { AgentModeShell } from './AgentModeShell';

interface PluginWorkspaceProps {
  registerPlatformHost?: RefCallback<HTMLDivElement>;
  onExitAgentMode?: () => void;
}

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponent: jest.fn(),
}));

jest.mock('app/core/context/GrafanaContext', () => ({
  useGrafana: jest.fn(),
}));

const usePluginComponentMock = jest.mocked(usePluginComponent);
const useGrafanaMock = jest.mocked(useGrafana);
const setAgentMode = jest.fn();

describe('AgentModeShell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGrafanaMock.mockReturnValue({ chrome: { setAgentMode } } as unknown as ReturnType<typeof useGrafana>);
  });

  it('renders nothing while the plugin component is loading', () => {
    usePluginComponentMock.mockReturnValue({
      component: null,
      isLoading: true,
    } as unknown as ReturnType<typeof usePluginComponent>);

    const { container } = render(<AgentModeShell outletRef={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no plugin component is available', () => {
    usePluginComponentMock.mockReturnValue({
      component: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof usePluginComponent>);

    const { container } = render(<AgentModeShell outletRef={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the plugin workspace and wires the platform host and exit callback', () => {
    const outletRef = jest.fn();
    const PluginWorkspace = jest.fn(({ registerPlatformHost, onExitAgentMode }: PluginWorkspaceProps) => {
      // Surface the props so the test can assert they were passed through.
      registerPlatformHost?.(null);
      return (
        <button type="button" data-testid="plugin-workspace" onClick={onExitAgentMode}>
          workspace
        </button>
      );
    });
    usePluginComponentMock.mockReturnValue({
      component: PluginWorkspace,
      isLoading: false,
    } as unknown as ReturnType<typeof usePluginComponent>);

    render(<AgentModeShell outletRef={outletRef} />);

    expect(screen.getByTestId('plugin-workspace')).toBeInTheDocument();
    expect(outletRef).toHaveBeenCalledWith(null);

    screen.getByTestId('plugin-workspace').click();
    expect(setAgentMode).toHaveBeenCalledWith(false);
  });
});
