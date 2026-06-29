import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps } from 'react';
import { Provider } from 'react-redux';

import {
  type DataFrame,
  EventBusSrv,
  type ExplorePanelsState,
  FieldType,
  LoadingState,
  LogLevel,
  type LogRowModel,
  toUtc,
  createDataFrame,
  type ExploreLogsPanelState,
  type DataQuery,
} from '@grafana/data';
import { mockTransformationsRegistry, organizeFieldsTransformer } from '@grafana/data/internal';
import { extractFieldsTransformer } from 'app/features/transformers/extractFields/extractFields';
import { LokiQueryDirection } from 'app/plugins/datasource/loki/dataquery.gen';
import { configureStore } from 'app/store/configureStore';

import { initialExploreState } from '../state/main';
import { makeExplorePaneState } from '../state/utils';

import { Logs } from './Logs';
import { visualisationTypeKey } from './utils/logs';
import { getMockElasticFrame, getMockLokiFrame } from './utils/mocks';

const reportInteraction = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: (interactionName: string, properties?: Record<string, unknown> | undefined) =>
    reportInteraction(interactionName, properties),
}));

const createAndCopyShortLink = jest.fn();
jest.mock('app/core/utils/shortLinks', () => ({
  ...jest.requireActual('app/core/utils/shortLinks'),
  createAndCopyShortLink: (url: string) => createAndCopyShortLink(url),
}));

const useBooleanFlagValueMock = jest.fn((_: string, defaultValue: boolean) => defaultValue);
const useFlagMock = jest.fn((_: string, defaultValue: boolean) => ({ value: defaultValue }));

const setBooleanFlags = (flags: Record<string, boolean>) => {
  const getFlagValue = (flag: string, defaultValue: boolean) =>
    Object.prototype.hasOwnProperty.call(flags, flag) ? flags[flag] : defaultValue;

  useBooleanFlagValueMock.mockImplementation((flag: string, defaultValue: boolean) => getFlagValue(flag, defaultValue));
  useFlagMock.mockImplementation((flag: string, defaultValue: boolean) => ({
    value: getFlagValue(flag, defaultValue),
  }));
};

jest.mock('@openfeature/react-sdk', () => ({
  ...jest.requireActual('@openfeature/react-sdk'),
  useBooleanFlagValue: (flag: string, defaultValue: boolean) => useBooleanFlagValueMock(flag, defaultValue),
  useFlag: (flag: string, defaultValue: boolean) => useFlagMock(flag, defaultValue),
}));

const fakeChangePanelState = jest.fn().mockReturnValue({ type: 'fakeAction' });
jest.mock('../state/explorePane', () => ({
  ...jest.requireActual('../state/explorePane'),
  changePanelState: (exploreId: string, panel: 'logs', panelState: {} | ExploreLogsPanelState) => {
    return fakeChangePanelState(exploreId, panel, panelState);
  },
}));

const fakeChangeQueries = jest.fn().mockReturnValue({ type: 'fakeChangeQueries' });
const fakeRunQueries = jest.fn().mockReturnValue({ type: 'fakeRunQueries' });
jest.mock('../state/query', () => ({
  ...jest.requireActual('../state/query'),
  changeQueries: (args: { queries: DataQuery[]; exploreId: string | undefined }) => {
    return fakeChangeQueries(args);
  },
  runQueries: (args: { queries: DataQuery[]; exploreId: string | undefined }) => {
    return fakeRunQueries(args);
  },
}));

describe('Logs', () => {
  let originalHref = window.location.href;

  beforeEach(() => {
    setBooleanFlags({ logsPanelControls: false });
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    window.HTMLElement.prototype.scroll = jest.fn();
    localStorage.clear();
    jest.clearAllMocks();
  });

  beforeAll(() => {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000/explore?test',
        search: '?test',
      },
      writable: true,
    });
  });
  beforeAll(() => {
    const transformers = [extractFieldsTransformer, organizeFieldsTransformer];
    mockTransformationsRegistry(transformers);
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      value: {
        href: originalHref,
      },
      writable: true,
    });
  });

  async function copyPermalinkFromLogMenu(menuIndex = 0) {
    const menus = await screen.findAllByLabelText('Log menu');
    await userEvent.click(menus[menuIndex]);
    await userEvent.click(await screen.findByText('Copy link to log line'));
  }

  const getComponent = (
    partialProps?: Partial<ComponentProps<typeof Logs>>,
    dataFrame?: DataFrame,
    logs?: LogRowModel[]
  ) => {
    const rows = [
      makeLog({ uid: '1', rowId: 'id1', timeEpochMs: 1 }),
      makeLog({ uid: '2', rowId: 'id2', timeEpochMs: 2 }),
      makeLog({ uid: '3', rowId: 'id3', timeEpochMs: 3 }),
    ];

    const testDataFrame = dataFrame ?? getMockLokiFrame();

    return (
      <Logs
        exploreId={'left'}
        splitOpen={() => undefined}
        logsVolumeEnabled={true}
        onSetLogsVolumeEnabled={() => null}
        onClickFilterLabel={() => null}
        onClickFilterOutLabel={() => null}
        logsVolumeData={undefined}
        loadLogsVolumeData={() => undefined}
        logRows={logs ?? rows}
        timeZone={'utc'}
        width={50}
        loading={false}
        loadingState={LoadingState.Done}
        absoluteRange={{
          from: toUtc('2019-01-01 10:00:00').valueOf(),
          to: toUtc('2019-01-01 16:00:00').valueOf(),
        }}
        range={{
          from: toUtc('2019-01-01 10:00:00'),
          to: toUtc('2019-01-01 16:00:00'),
          raw: { from: 'now-1h', to: 'now' },
        }}
        onChangeTime={() => {}}
        getFieldLinks={() => {
          return [];
        }}
        eventBus={new EventBusSrv()}
        isFilterLabelActive={jest.fn()}
        logsFrames={[testDataFrame]}
        {...partialProps}
      />
    );
  };

  const setup = (partialProps?: Partial<ComponentProps<typeof Logs>>, dataFrame?: DataFrame, logs?: LogRowModel[]) => {
    const fakeStore = configureStore({
      explore: {
        ...initialExploreState,
        panes: {
          left: makeExplorePaneState(),
        },
      },
    });

    const rendered = render(
      <Provider store={fakeStore}>
        {getComponent(partialProps, dataFrame ? dataFrame : getMockLokiFrame(), logs)}
      </Provider>
    );
    return { ...rendered, store: fakeStore };
  };

  it('should render logs', async () => {
    setup();
    const logsSection = screen.getByTestId('logRows');
    expect(logsSection).toBeInTheDocument();
    expect(await screen.findByText('log message 3')).toBeInTheDocument();
    expect(screen.getByText('log message 2')).toBeInTheDocument();
    expect(screen.getByText('log message 1')).toBeInTheDocument();
  });

  it('should render no logs found', () => {
    setup({}, undefined, []);

    expect(screen.getByText(/no logs found\./i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /scan for older logs/i,
      })
    ).toBeInTheDocument();
  });

  it('should render an actionable message when frames have rows but no time field', () => {
    const frameWithoutTime = createDataFrame({
      fields: [{ name: 'message', type: FieldType.string, values: ['log message 1', 'log message 2'] }],
    });
    setup({}, frameWithoutTime, []);

    expect(
      screen.getByText('The Logs visualization requires a time field. Add a time-typed column to your query.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/no logs found\./i)).not.toBeInTheDocument();
  });

  it('should render a load more button', () => {
    const scanningStarted = jest.fn();
    const store = configureStore({
      explore: {
        ...initialExploreState,
      },
    });
    render(
      <Provider store={store}>
        <Logs
          logsFrames={undefined}
          exploreId={'left'}
          splitOpen={() => undefined}
          logsVolumeEnabled={true}
          onSetLogsVolumeEnabled={() => null}
          onClickFilterLabel={() => null}
          onClickFilterOutLabel={() => null}
          logsVolumeData={undefined}
          loadLogsVolumeData={() => undefined}
          logRows={[]}
          onStartScanning={scanningStarted}
          timeZone={'utc'}
          width={50}
          loading={false}
          loadingState={LoadingState.Done}
          absoluteRange={{
            from: toUtc('2019-01-01 10:00:00').valueOf(),
            to: toUtc('2019-01-01 16:00:00').valueOf(),
          }}
          range={{
            from: toUtc('2019-01-01 10:00:00'),
            to: toUtc('2019-01-01 16:00:00'),
            raw: { from: 'now-1h', to: 'now' },
          }}
          onChangeTime={() => {}}
          getFieldLinks={() => {
            return [];
          }}
          eventBus={new EventBusSrv()}
          isFilterLabelActive={jest.fn()}
        />
      </Provider>
    );
    const button = screen.getByRole('button', {
      name: /scan for older logs/i,
    });
    button.click();
    expect(scanningStarted).toHaveBeenCalled();
  });

  it('should render a stop scanning button', () => {
    const store = configureStore({
      explore: {
        ...initialExploreState,
      },
    });
    render(
      <Provider store={store}>
        <Logs
          logsFrames={undefined}
          exploreId={'left'}
          splitOpen={() => undefined}
          logsVolumeEnabled={true}
          onSetLogsVolumeEnabled={() => null}
          onClickFilterLabel={() => null}
          onClickFilterOutLabel={() => null}
          logsVolumeData={undefined}
          loadLogsVolumeData={() => undefined}
          logRows={[]}
          scanning={true}
          timeZone={'utc'}
          width={50}
          loading={false}
          loadingState={LoadingState.Done}
          absoluteRange={{
            from: toUtc('2019-01-01 10:00:00').valueOf(),
            to: toUtc('2019-01-01 16:00:00').valueOf(),
          }}
          range={{
            from: toUtc('2019-01-01 10:00:00'),
            to: toUtc('2019-01-01 16:00:00'),
            raw: { from: 'now-1h', to: 'now' },
          }}
          onChangeTime={() => {}}
          getFieldLinks={() => {
            return [];
          }}
          eventBus={new EventBusSrv()}
          isFilterLabelActive={jest.fn()}
        />
      </Provider>
    );

    expect(
      screen.getByRole('button', {
        name: /stop scan/i,
      })
    ).toBeInTheDocument();
  });

  it('should render a stop scanning button', () => {
    const scanningStopped = jest.fn();
    const store = configureStore({
      explore: {
        ...initialExploreState,
      },
    });
    render(
      <Provider store={store}>
        <Logs
          logsFrames={undefined}
          exploreId={'left'}
          splitOpen={() => undefined}
          logsVolumeEnabled={true}
          onSetLogsVolumeEnabled={() => null}
          onClickFilterLabel={() => null}
          onClickFilterOutLabel={() => null}
          logsVolumeData={undefined}
          loadLogsVolumeData={() => undefined}
          logRows={[]}
          scanning={true}
          onStopScanning={scanningStopped}
          timeZone={'utc'}
          width={50}
          loading={false}
          loadingState={LoadingState.Done}
          absoluteRange={{
            from: toUtc('2019-01-01 10:00:00').valueOf(),
            to: toUtc('2019-01-01 16:00:00').valueOf(),
          }}
          range={{
            from: toUtc('2019-01-01 10:00:00'),
            to: toUtc('2019-01-01 16:00:00'),
            raw: { from: 'now-1h', to: 'now' },
          }}
          onChangeTime={() => {}}
          getFieldLinks={() => {
            return [];
          }}
          eventBus={new EventBusSrv()}
          isFilterLabelActive={jest.fn()}
        />
      </Provider>
    );

    const button = screen.getByRole('button', {
      name: /stop scan/i,
    });
    button.click();
    expect(scanningStopped).toHaveBeenCalled();
  });

  it('should flip the order', async () => {
    setup();
    const sortOrderToggle = screen.getByRole('button', { name: /sorted by newest logs first/i });
    await userEvent.click(sortOrderToggle);
    expect(await screen.findByText('log message 1')).toBeInTheDocument();
    expect(screen.getByText('log message 3')).toBeInTheDocument();
    expect(fakeRunQueries).not.toHaveBeenCalled();
  });

  it('should sync the query direction when changing the order of loki queries', async () => {
    const query = { expr: '{a="b"}', refId: 'A', datasource: { type: 'loki' } };
    setup({ logsQueries: [query] });
    const sortOrderToggle = screen.getByRole('button', { name: /sorted by newest logs first/i });
    await userEvent.click(sortOrderToggle);
    expect(fakeChangeQueries).toHaveBeenCalledWith({
      exploreId: 'left',
      queries: [{ ...query, direction: LokiQueryDirection.Forward }],
    });
    expect(fakeRunQueries).toHaveBeenCalledWith({ exploreId: 'left' });
  });

  it('should not change the query direction when changing the order of non-loki queries', async () => {
    fakeChangeQueries.mockClear();
    const query = { refId: 'B' };
    setup({ logsQueries: [query] });
    const sortOrderToggle = screen.getByRole('button', { name: /sorted by newest logs first/i });
    await userEvent.click(sortOrderToggle);
    expect(fakeChangeQueries).not.toHaveBeenCalled();
  });

  describe('for permalinking', () => {
    it('should dispatch a `changePanelState` event without the id', () => {
      const panelState = { logs: { id: '1' } };
      const { rerender, store } = setup({ loading: false, panelState });

      rerender(<Provider store={store}>{getComponent({ loading: true, exploreId: 'right', panelState })}</Provider>);
      rerender(<Provider store={store}>{getComponent({ loading: false, exploreId: 'right', panelState })}</Provider>);

      expect(fakeChangePanelState).toHaveBeenCalledWith('right', 'logs', { logs: {} });
    });

    it('should call reportInteraction on permalinkClick', async () => {
      const panelState = { logs: { id: 'not-included' } };
      const rows = [
        makeLog({ uid: '1', rowId: 'id1', timeEpochMs: 4 }),
        makeLog({ uid: '2', rowId: 'id2', timeEpochMs: 3 }),
        makeLog({ uid: '3', rowId: 'id3', timeEpochMs: 2 }),
        makeLog({ uid: '4', rowId: 'id3', timeEpochMs: 1 }),
      ];
      setup({ loading: false, panelState, logRows: rows });

      await copyPermalinkFromLogMenu(0);

      expect(reportInteraction).toHaveBeenCalledWith('grafana_explore_logs_permalink_clicked', {
        datasourceType: 'unknown',
        logRowUid: '1',
        logRowLevel: 'debug',
      });
    });

    it('should call createAndCopyShortLink on permalinkClick - logs', async () => {
      const panelState: Partial<ExplorePanelsState> = {
        logs: { id: 'not-included', visualisationType: 'logs', displayedFields: ['field'] },
      };
      const rows = [
        makeLog({ uid: '1', rowId: 'id1', timeEpochMs: 1, labels: { field: '1' } }),
        makeLog({ uid: '2', rowId: 'id2', timeEpochMs: 1, labels: { field: '2' } }),
        makeLog({ uid: '3', rowId: 'id3', timeEpochMs: 2, labels: { field: '3' } }),
        makeLog({ uid: '4', rowId: 'id3', timeEpochMs: 2, labels: { field: '4' } }),
      ];
      setup({ loading: false, panelState, logRows: rows });

      await copyPermalinkFromLogMenu(0);

      expect(createAndCopyShortLink).toHaveBeenCalledWith(
        expect.stringMatching(
          'range%22:%7B%22from%22:%222019-01-01T10:00:00.000Z%22,%22to%22:%222019-01-01T16:00:00.000Z%22%7D'
        )
      );
      expect(createAndCopyShortLink).toHaveBeenCalledWith(expect.stringMatching('visualisationType%22:%22logs'));
      expect(createAndCopyShortLink).toHaveBeenCalledWith(expect.stringMatching('displayedFields%22:%5B%22field'));
    });

    it('should call createAndCopyShortLink on permalinkClick - with infinite scrolling', async () => {
      const rows = [
        makeLog({ uid: '1', rowId: 'id1', timeEpochMs: 1 }),
        makeLog({ uid: '2', rowId: 'id2', timeEpochMs: 1 }),
        makeLog({ uid: '3', rowId: 'id3', timeEpochMs: 2 }),
        makeLog({ uid: '4', rowId: 'id3', timeEpochMs: 2 }),
      ];

      const panelState: Partial<ExplorePanelsState> = { logs: { id: 'not-included', visualisationType: 'logs' } };
      setup({ loading: false, panelState, logRows: rows });

      await copyPermalinkFromLogMenu(3);

      expect(createAndCopyShortLink).toHaveBeenCalledWith(
        expect.stringMatching(
          'range%22:%7B%22from%22:%222019-01-01T10:00:00.000Z%22,%22to%22:%222019-01-01T16:00:00.000Z%22%7D'
        )
      );
      expect(createAndCopyShortLink).toHaveBeenCalledWith(expect.stringMatching('visualisationType%22:%22logs'));
    });
  });

  describe('displayed fields', () => {
    it('should sync displayed fields from the URL', async () => {
      const panelState: Partial<ExplorePanelsState> = {
        logs: { id: 'not-included', visualisationType: 'logs', displayedFields: ['field'] },
      };
      const rows = [makeLog({ uid: '1', rowId: 'id1', timeEpochMs: 1, labels: { field: 'field value' } })];
      setup({ loading: false, panelState, logRows: rows });

      expect(await screen.findByText(/field value/)).toBeInTheDocument();
      expect(screen.queryByText(/log message/)).not.toBeInTheDocument();
    });
  });

  describe('with table visualisation', () => {
    it('should show visualisation type radio group', () => {
      setup();
      const logsSection = screen.getByRole('radio', { name: 'Table' });
      expect(logsSection).toBeInTheDocument();
    });

    it('should change visualisation to table on toggle (loki)', async () => {
      setup({});
      const logsSection = screen.getByRole('radio', { name: 'Table' });
      await userEvent.click(logsSection);

      const table = await screen.findByRole('grid');
      expect(table).toBeInTheDocument();
    });

    it('should use default state from localstorage - table', async () => {
      localStorage.setItem(visualisationTypeKey, 'table');
      setup({});
      const table = await screen.findByRole('grid');
      expect(table).toBeInTheDocument();
    });

    it('should use default state from localstorage - logs', async () => {
      localStorage.setItem(visualisationTypeKey, 'logs');
      setup({});
      const table = await screen.findByTestId('logRows');
      expect(table).toBeInTheDocument();
    });

    it('should change visualisation to table on toggle (elastic)', async () => {
      setup({}, getMockElasticFrame());
      const logsSection = screen.getByRole('radio', { name: 'Table' });
      await userEvent.click(logsSection);

      const table = await screen.findByRole('grid');
      expect(table).toBeInTheDocument();
    });
  });
  describe('with table panel visualisation', () => {
    let origResizeObserver = global.ResizeObserver;

    beforeEach(() => {
      origResizeObserver = global.ResizeObserver;
      // Mock ResizeObserver
      global.ResizeObserver = class ResizeObserver {
        constructor(callback: unknown) {
          // Store the callback
          this.callback = callback;
        }
        callback: unknown;
        observe() {
          // Do nothing
        }
        unobserve() {
          // Do nothing
        }
        disconnect() {
          // Do nothing
        }
      };

      setBooleanFlags({
        logsPanelControls: true,
        logsTablePanelNG: false,
      });
    });

    afterEach(() => {
      global.ResizeObserver = origResizeObserver;
    });

    it('should show table', async () => {
      setup({
        panelState: {
          logs: {
            visualisationType: 'table',
          },
        },
      });
      await waitFor(() => expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument());
      expect(await screen.findByRole('grid')).toBeInTheDocument();
    });

    it('should show logs', async () => {
      setup({
        panelState: {
          logs: {
            visualisationType: 'logs',
          },
        },
      });

      await waitFor(() => expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument());
      const logs = await screen.findByTestId('logRows');
      expect(logs).toBeInTheDocument();
      expect(screen.getByText('log message 3')).toBeVisible();
    });

    it('should show logs when logsPanelControls is enabled and logsTablePanelNG is true', async () => {
      setBooleanFlags({
        logsPanelControls: true,
        logsTablePanelNG: true,
      });

      setup({
        panelState: {
          logs: {
            visualisationType: 'logs',
          },
        },
      });

      await waitFor(() => expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument());
      const logs = await screen.findByTestId('logRows');
      expect(logs).toBeInTheDocument();
      expect(screen.getByText('log message 3')).toBeVisible();
    });
  });
});

const makeLog = (overrides: Partial<LogRowModel>): LogRowModel => {
  const uid = overrides.uid || '1';
  const entry = `log message ${uid}`;
  return {
    uid,
    entryFieldIndex: 0,
    rowIndex: 0,
    dataFrame: createDataFrame({ fields: [] }),
    logLevel: LogLevel.debug,
    entry,
    hasAnsi: false,
    hasUnescapedContent: false,
    labels: {},
    raw: entry,
    timeFromNow: '',
    timeEpochMs: 1,
    timeEpochNs: '1000000',
    timeLocal: '',
    timeUtc: '',
    ...overrides,
  };
};
