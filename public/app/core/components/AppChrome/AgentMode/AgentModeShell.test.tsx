import { render, screen } from '@testing-library/react';

import { usePluginComponent } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { AgentModeShell } from './AgentModeShell';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useGrafanaMock.mockReturnValue({ chrome: { setAgentMode } } as any);
  });

  it('renders nothing while the plugin component is loading', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usePluginComponentMock.mockReturnValue({ component: null, isLoading: true } as any);

    const { container } = render(<AgentModeShell outletRef={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no plugin component is available', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usePluginComponentMock.mockReturnValue({ component: undefined, isLoading: false } as any);

    const { container } = render(<AgentModeShell outletRef={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the plugin workspace and wires the platform host and exit callback', () => {
    const outletRef = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PluginWorkspace = jest.fn(({ registerPlatformHost, onExitAgentMode }: any) => {
      // Surface the props so the test can assert they were passed through.
      registerPlatformHost?.('host-node');
      return (
        <button type="button" data-testid="plugin-workspace" onClick={onExitAgentMode}>
          workspace
        </button>
      );
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usePluginComponentMock.mockReturnValue({ component: PluginWorkspace, isLoading: false } as any);

    render(<AgentModeShell outletRef={outletRef} />);

    expect(screen.getByTestId('plugin-workspace')).toBeInTheDocument();
    expect(outletRef).toHaveBeenCalledWith('host-node');

    screen.getByTestId('plugin-workspace').click();
    expect(setAgentMode).toHaveBeenCalledWith(false);
  });
});
