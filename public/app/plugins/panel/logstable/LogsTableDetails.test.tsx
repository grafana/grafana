import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTime } from '@grafana/data/datetime';
import { EventBusSrv } from '@grafana/data/events';
import { CoreApp, LogLevel } from '@grafana/data/types';
import { type DataSourceSrv, getDataSourceSrv, usePluginLinks } from '@grafana/runtime';
import { defaultTableOptions } from '@grafana/schema';
import { type PanelContext, PanelContextProvider } from '@grafana/ui';
import { createLogLine } from 'app/features/logs/components/mocks/logRow';
import { type LogListModel } from 'app/features/logs/components/panel/processing';
import { createLokiDatasource } from 'app/plugins/datasource/loki/mocks/datasource';

import { emptyContextData, LogDetailsContext, type LogDetailsContextData } from './LogDetailsContext';
import { getDefaultLogDetailsWidth, LogsTableDetails } from './LogsTableDetails';
import { type Options } from './options/types';
import { defaultOptions } from './panelcfg.gen';

jest.mock('@openfeature/react-sdk', () => ({
  useBooleanFlagValue: jest.fn().mockReturnValue(false),
}));

jest.mock('../../../features/logs/components/fieldSelector/FieldSelector');
jest.mock('../../../features/logs/components/fieldSelector/fieldSelectorUtils');

jest.mock('@grafana/assistant', () => {
  return {
    ...jest.requireActual('@grafana/assistant'),
    useAssistant: jest.fn().mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant: jest.fn(),
    }),
  };
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
  usePluginLinks: jest.fn(),
}));

jest.mock('app/features/explore/TraceView/TraceView', () => ({
  TraceView: () => <div>Trace view</div>,
}));

afterAll(() => {
  jest.unmock('app/features/explore/TraceView/TraceView');
});

const timeRange = {
  from: dateTime(1757937009041),
  to: dateTime(1757940609041),
  raw: {
    from: 'now-1h',
    to: 'now',
  },
};

const baseOptions: Options = {
  frameIndex: 0,
  showHeader: true,
  ...defaultOptions,
  ...defaultTableOptions,
};

let lokiDS = createLokiDatasource(undefined, { uid: 'loki-ds' });

const setup = (
  detailsOverrides?: Partial<LogDetailsContextData>,
  optionsOverrides?: Partial<Options>,
  panelContext?: Partial<PanelContext>,
  onOptionsChange = jest.fn(),
  logsOverride?: LogListModel[]
) => {
  const logs = logsOverride ?? [
    createLogLine({
      logLevel: LogLevel.error,
      timeEpochMs: 1546297200000,
      datasourceUid: lokiDS.uid,
      labels: { svc: 'api' },
    }),
  ];

  const detailsData: LogDetailsContextData = {
    ...emptyContextData,
    enableLogDetails: true,
    logs,
    showDetails: logs,
    currentLog: logs[0],
    closeDetails: jest.fn(),
    setCurrentLog: jest.fn(),
    toggleDetails: jest.fn(),
    ...detailsOverrides,
  };

  const result = render(
    <PanelContextProvider
      value={{
        eventsScope: 'test',
        eventBus: new EventBusSrv(),
        app: CoreApp.Dashboard,
        ...panelContext,
      }}
    >
      <LogDetailsContext.Provider value={detailsData}>
        <LogsTableDetails
          containerElement={null}
          options={{ ...baseOptions, ...optionsOverrides }}
          onOptionsChange={onOptionsChange}
          timeRange={timeRange}
          timeZone="UTC"
        />
      </LogDetailsContext.Provider>
    </PanelContextProvider>
  );

  return { ...result, detailsData, logs };
};

describe('LogsTableDetails', () => {
  beforeEach(() => {
    lokiDS = createLokiDatasource(undefined, { uid: 'loki-ds' });
    jest.mocked(usePluginLinks).mockReturnValue({
      links: [],
      isLoading: false,
    });
    jest.mocked(getDataSourceSrv).mockImplementation(
      () =>
        ({
          get: (uid: string) => {
            if (uid === 'loki-ds') {
              return Promise.resolve(lokiDS);
            }
            return Promise.resolve(null);
          },
        }) as unknown as DataSourceSrv
    );
  });

  test('returns null when log details are disabled', () => {
    const { container } = setup({ enableLogDetails: false });
    expect(container.firstChild).toBeNull();
  });

  test('returns null when there is no current log', () => {
    const { container } = setup({ currentLog: undefined });
    expect(container.firstChild).toBeNull();
  });

  test('renders log details for the current log', async () => {
    setup(undefined, undefined, undefined, jest.fn());

    await waitFor(() => {
      expect(screen.getByText('Log line')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Search field names and values')).toBeInTheDocument();
  });

  test('does not render tabs for a single open log', async () => {
    setup();

    await waitFor(() => {
      expect(screen.getByText('Log line')).toBeInTheDocument();
    });
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  test('renders a tab per open log and switches the active log', async () => {
    const logA = createLogLine({
      uid: 'a',
      logLevel: LogLevel.info,
      timeEpochMs: 1546297200000,
      entry: 'First log line content',
      datasourceUid: lokiDS.uid,
    });
    const logB = createLogLine({
      uid: 'b',
      logLevel: LogLevel.warn,
      timeEpochMs: 1546297200001,
      entry: 'Second log line content',
      datasourceUid: lokiDS.uid,
    });

    const setCurrentLog = jest.fn();
    const detailsData: LogDetailsContextData = {
      ...emptyContextData,
      enableLogDetails: true,
      logs: [logA, logB],
      showDetails: [logA, logB],
      currentLog: logB,
      closeDetails: jest.fn(),
      setCurrentLog,
      toggleDetails: jest.fn(),
    };

    render(
      <PanelContextProvider value={{ eventsScope: 'test', eventBus: new EventBusSrv(), app: CoreApp.Dashboard }}>
        <LogDetailsContext.Provider value={detailsData}>
          <LogsTableDetails
            containerElement={null}
            options={baseOptions}
            onOptionsChange={jest.fn()}
            timeRange={timeRange}
            timeZone="UTC"
          />
        </LogDetailsContext.Provider>
      </PanelContextProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Log line')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('tab')).toHaveLength(2);
    // Tabs are reversed: last opened appears first.
    expect(screen.getByRole('tab', { name: /Second log line content/i })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: /First log line content/i }));

    expect(setCurrentLog).toHaveBeenCalledWith(logA);
  });

  test('removes a log from details when the tab remove control is used', async () => {
    const logA = createLogLine({
      uid: 'a',
      logLevel: LogLevel.info,
      timeEpochMs: 1546297200000,
      entry: 'Alpha log',
      datasourceUid: lokiDS.uid,
    });
    const logB = createLogLine({
      uid: 'b',
      logLevel: LogLevel.warn,
      timeEpochMs: 1546297200001,
      entry: 'Beta log',
      datasourceUid: lokiDS.uid,
    });

    const toggleDetails = jest.fn();

    const detailsData: LogDetailsContextData = {
      ...emptyContextData,
      enableLogDetails: true,
      logs: [logA, logB],
      showDetails: [logA, logB],
      currentLog: logB,
      closeDetails: jest.fn(),
      setCurrentLog: jest.fn(),
      toggleDetails,
    };

    render(
      <PanelContextProvider value={{ eventsScope: 'test', eventBus: new EventBusSrv(), app: CoreApp.Dashboard }}>
        <LogDetailsContext.Provider value={detailsData}>
          <LogsTableDetails
            containerElement={null}
            options={baseOptions}
            onOptionsChange={jest.fn()}
            timeRange={timeRange}
            timeZone="UTC"
          />
        </LogDetailsContext.Provider>
      </PanelContextProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Log line')).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByLabelText('Remove log');
    await userEvent.click(removeButtons[0]);

    expect(toggleDetails).toHaveBeenCalledWith(logB);
  });

  test('closes details on Escape when at least one log is open', async () => {
    const closeDetails = jest.fn();
    setup({ closeDetails });

    await waitFor(() => {
      expect(screen.getByText('Log line')).toBeInTheDocument();
    });

    expect(closeDetails).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');

    expect(closeDetails).toHaveBeenCalledTimes(1);
  });

  test('calls replaceDetails when ArrowDown and ArrowUp navigate the log list', async () => {
    const logA = createLogLine({
      uid: 'a',
      logLevel: LogLevel.info,
      timeEpochMs: 1546297200000,
      datasourceUid: lokiDS.uid,
    });
    const logB = createLogLine({
      uid: 'b',
      logLevel: LogLevel.warn,
      timeEpochMs: 1546297200001,
      datasourceUid: lokiDS.uid,
    });
    const logC = createLogLine({
      uid: 'c',
      logLevel: LogLevel.error,
      timeEpochMs: 1546297200002,
      datasourceUid: lokiDS.uid,
    });
    const allLogs = [logA, logB, logC];
    const replaceDetails = jest.fn();

    setup({ currentLog: logB, showDetails: allLogs, replaceDetails }, undefined, undefined, jest.fn(), allLogs);

    await waitFor(() => {
      expect(screen.getByText('Log line')).toBeInTheDocument();
    });

    await userEvent.keyboard('{ArrowDown}');

    expect(replaceDetails).toHaveBeenCalledTimes(1);
    expect(replaceDetails).toHaveBeenCalledWith(logC);

    replaceDetails.mockClear();

    await userEvent.keyboard('{ArrowUp}');

    expect(replaceDetails).toHaveBeenCalledTimes(1);
    expect(replaceDetails).toHaveBeenCalledWith(logA);
  });

  test('forwards label filters to the panel ad-hoc filter handler', async () => {
    const onAddAdHocFilter = jest.fn();
    const labeledLog = createLogLine({
      logLevel: LogLevel.error,
      timeEpochMs: 1546297200000,
      datasourceUid: lokiDS.uid,
      labels: { env: 'prod' },
    });
    setup(undefined, undefined, { onAddAdHocFilter }, jest.fn(), [labeledLog]);

    await waitFor(() => {
      expect(screen.getByText('Fields')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText(/^Filter for value/));

    expect(onAddAdHocFilter).toHaveBeenCalledWith({
      key: 'env',
      value: 'prod',
      operator: '=',
    });
  });

  test('forwards label filter-out to the panel ad-hoc filter handler', async () => {
    const onAddAdHocFilter = jest.fn();
    const labeledLog = createLogLine({
      logLevel: LogLevel.error,
      timeEpochMs: 1546297200000,
      datasourceUid: lokiDS.uid,
      labels: { env: 'prod' },
    });
    setup(undefined, undefined, { onAddAdHocFilter }, jest.fn(), [labeledLog]);

    await waitFor(() => {
      expect(screen.getByText('Fields')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText(/^Filter out value/));

    expect(onAddAdHocFilter).toHaveBeenCalledWith({
      key: 'env',
      value: 'prod',
      operator: '!=',
    });
  });

  test('applies logDetailsWidth from panel options on the resizable container', async () => {
    setup(undefined, { logDetailsWidth: 428 });

    await waitFor(() => {
      expect(screen.getByText('Log line')).toBeInTheDocument();
    });

    const sized = document.querySelector('[style*="428px"]');
    expect(sized).toBeTruthy();
  });
});

describe('getDefaultLogDetailsWidth', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
  });

  test('uses forty percent of the viewport with a minimum of 400', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 900 });
    expect(getDefaultLogDetailsWidth()).toBe(Math.max(Math.round(900 * 0.4), 400));
  });

  test('returns at least 400 for narrow viewports', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 });
    expect(getDefaultLogDetailsWidth()).toBe(400);
  });
});
