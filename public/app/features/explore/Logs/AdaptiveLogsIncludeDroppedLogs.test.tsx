import { render, screen } from '@testing-library/react';

import { LoadingState } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import { LogsSortOrder } from '@grafana/schema';
import { createLogLine } from 'app/features/logs/components/mocks/logRow';

import { AdaptiveLogsIncludeDroppedLogs } from './AdaptiveLogsIncludeDroppedLogs';

const useFlagMock = jest.fn((_: string, defaultValue: boolean) => ({ value: defaultValue }));

const setTimeMachineEnabled = (enabled: boolean) => {
  useFlagMock.mockImplementation(() => ({ value: enabled }));
};

jest.mock('@openfeature/react-sdk', () => ({
  ...jest.requireActual('@openfeature/react-sdk'),
  useFlag: (flag: string, defaultValue: boolean) => useFlagMock(flag, defaultValue),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponent: jest.fn(),
}));

const usePluginComponentMock = jest.mocked(usePluginComponent);

const receivedProps = jest.fn();
function PluginComponent(props: object) {
  receivedProps(props);
  return <div>Include dropped logs</div>;
}

function mockPluginComponent(result: { component: typeof PluginComponent | null; isLoading: boolean }) {
  usePluginComponentMock.mockReturnValue(result as unknown as ReturnType<typeof usePluginComponent>);
}

const props = {
  includeAdditionalLogs: jest.fn(),
  logs: [createLogLine({ uid: 'log-1' })],
  logsLoadingState: LoadingState.Streaming,
  queries: [{ refId: 'A' }],
  renderedLogsWindow: {
    startRowIndex: 0,
    endRowIndex: 0,
    logsSortOrder: LogsSortOrder.Descending,
    logs: [createLogLine({ uid: 'log-1' })],
  },
};

describe('AdaptiveLogsIncludeDroppedLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTimeMachineEnabled(true);
  });

  it('renders nothing when the adaptivelogs.enableTimeMachine flag is disabled', () => {
    setTimeMachineEnabled(false);
    mockPluginComponent({ component: PluginComponent, isLoading: false });

    const { container } = render(<AdaptiveLogsIncludeDroppedLogs {...props} />);

    expect(container).toBeEmptyDOMElement();
    expect(receivedProps).not.toHaveBeenCalled();
  });

  it('renders the plugin component with all props passed through when everything is present', () => {
    mockPluginComponent({ component: PluginComponent, isLoading: false });

    render(<AdaptiveLogsIncludeDroppedLogs {...props} />);

    expect(screen.getByText('Include dropped logs')).toBeInTheDocument();
    expect(receivedProps).toHaveBeenLastCalledWith(props);
    expect(usePluginComponentMock).toHaveBeenCalledWith('grafana-adaptivelogs-app/include-dropped-logs/v1');
  });

  it('renders nothing while the plugin component is loading', () => {
    mockPluginComponent({ component: PluginComponent, isLoading: true });

    const { container } = render(<AdaptiveLogsIncludeDroppedLogs {...props} />);

    expect(container).toBeEmptyDOMElement();
    expect(receivedProps).not.toHaveBeenCalled();
  });

  it('renders nothing when the plugin does not expose the component', () => {
    mockPluginComponent({ component: null, isLoading: false });

    const { container } = render(<AdaptiveLogsIncludeDroppedLogs {...props} />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    { desc: 'missing', queries: undefined },
    { desc: 'empty', queries: [] },
  ])('renders nothing when queries is $desc', ({ queries }) => {
    mockPluginComponent({ component: PluginComponent, isLoading: false });

    const { container } = render(<AdaptiveLogsIncludeDroppedLogs {...props} queries={queries} />);

    expect(container).toBeEmptyDOMElement();
    expect(receivedProps).not.toHaveBeenCalled();
  });

  it.each([
    { desc: 'renderedLogsWindow is missing', override: { renderedLogsWindow: undefined } },
    { desc: 'includeAdditionalLogs is missing', override: { includeAdditionalLogs: undefined } },
    {
      desc: 'renderedLogsWindow.logs is empty',
      override: { renderedLogsWindow: { ...props.renderedLogsWindow, logs: [] } },
    },
  ])('renders the plugin component when $desc', ({ override }) => {
    mockPluginComponent({ component: PluginComponent, isLoading: false });

    render(<AdaptiveLogsIncludeDroppedLogs {...props} {...override} />);

    expect(screen.getByText('Include dropped logs')).toBeInTheDocument();
    expect(receivedProps).toHaveBeenLastCalledWith({ ...props, ...override });
  });
});
