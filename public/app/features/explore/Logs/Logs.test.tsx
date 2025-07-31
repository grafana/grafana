import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { Provider } from 'react-redux';

import {
  DataFrame,
  EventBusSrv,
  ExplorePanelsState,
  LoadingState,
  LogLevel,
  LogRowModel,
  toUtc,
  createDataFrame,
  ExploreLogsPanelState,
  DataQuery,
} from '@grafana/data';
import { mockTransformationsRegistry, organizeFieldsTransformer } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
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
    localStorage.clear();
    jest.clearAllMocks();
  });

  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000/explore?test',
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
        addResultsToCache={() => {}}
        onChangeTime={() => {}}
        clearCache={() => {}}
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

  describe('scrolling behavior', () => {
    let originalInnerHeight: number;
    beforeEach(() => {
      originalInnerHeight = window.innerHeight;
      window.innerHeight = 1000;
      window.HTMLElement.prototype.scrollIntoView = jest.fn();
      window.HTMLElement.prototype.scroll = jest.fn();
    });
    afterEach(() => {
      window.innerHeight = originalInnerHeight;
    });

    it('should call `scrollElement.scroll`', () => {
      const logs = [];
      for (let i = 0; i < 50; i++) {
        logs.push(makeLog({ uid: `uid${i}`, rowId: `id${i}`, timeEpochMs: i }));
      }
      const scrollElementMock = {
        scroll: jest.fn(),
        scrollTop: 920,
      };
      setup(
        { scrollElement: scrollElementMock as unknown as HTMLDivElement, panelState: { logs: { id: 'uid47' } } },
        undefined,
        logs
      );

      // element.getBoundingClientRect().top will always be 0 for jsdom
      // calc will be `scrollElement.scrollTop - window.innerHeight / 2` -> 920 - 500 = 420
      expect(scrollElementMock.scroll).toBeCalledWith({ behavior: 'smooth', top: 420 });
    });
  });

  it('should render logs', () => {
    setup();
    const logsSection = screen.getByTestId('logRows');
    let logRows = logsSection.querySelectorAll('tr');
    expect(logRows.length).toBe(3);
    expect(logRows[0].textContent).toContain('log message 3');
    expect(logRows[2].textContent).toContain('log message 1');
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
          addResultsToCache={() => {}}
          onChangeTime={() => {}}
          clearCache={() => {}}
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
          addResultsToCache={() => {}}
          onChangeTime={() => {}}
          clearCache={() => {}}
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
          addResultsToCache={() => {}}
          onChangeTime={() => {}}
          clearCache={() => {}}
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
    const oldestFirstSelection = screen.getByLabelText('Oldest first');
    await userEvent.click(oldestFirstSelection);
    const logsSection = screen.getByTestId('logRows');
    let logRows = logsSection.querySelectorAll('tr');
    expect(logRows.length).toBe(3);
    expect(logRows[0].textContent).toContain('log message 1');
    expect(logRows[2].textContent).toContain('log message 3');
    expect(fakeRunQueries).not.toHaveBeenCalled();
  });

  it('should sync the query direction when changing the order of loki queries', async () => {
    const query = { expr: '{a="b"}', refId: 'A', datasource: { type: 'loki' } };
    setup({ logsQueries: [query] });
    const oldestFirstSelection = screen.getByLabelText('Oldest first');
    await userEvent.click(oldestFirstSelection);
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
    const oldestFirstSelection = screen.getByLabelText('Oldest first');
    await userEvent.click(oldestFirstSelection);
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

    it('should scroll the scrollElement into view if rows contain id', () => {
      const panelState = { logs: { id: '3' } };
      const scrollElementMock = { scroll: jest.fn() };
      setup({ loading: false, scrollElement: scrollElementMock as unknown as HTMLDivElement, panelState });

      expect(scrollElementMock.scroll).toHaveBeenCalled();
    });

    it('should not scroll the scrollElement into view if rows does not contain id', () => {
      const panelState = { logs: { id: 'not-included' } };
      const scrollElementMock = { scroll: jest.fn() };
      setup({ loading: false, scrollElement: scrollElementMock as unknown as HTMLDivElement, panelState });

      expect(scrollElementMock.scroll).not.toHaveBeenCalled();
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

      const row = screen.getAllByRole('row');
      await userEvent.hover(row[0]);

      const linkButton = screen.getByLabelText('Copy shortlink');
      await userEvent.click(linkButton);

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

      const row = screen.getAllByRole('row');
      await userEvent.hover(row[0]);

      const linkButton = screen.getByLabelText('Copy shortlink');
      await userEvent.click(linkButton);

      expect(createAndCopyShortLink).toHaveBeenCalledWith(
        expect.stringMatching(
          'range%22:%7B%22from%22:%222019-01-01T10:00:00.000Z%22,%22to%22:%222019-01-01T16:00:00.000Z%22%7D'
        )
      );
      expect(createAndCopyShortLink).toHaveBeenCalledWith(expect.stringMatching('visualisationType%22:%22logs'));
      expect(createAndCopyShortLink).toHaveBeenCalledWith(expect.stringMatching('displayedFields%22:%5B%22field'));
    });

    it('should call createAndCopyShortLink on permalinkClick - with infinite scrolling', async () => {
      const featureToggleValue = config.featureToggles.logsInfiniteScrolling;
      config.featureToggles.logsInfiniteScrolling = true;
      const rows = [
        makeLog({ uid: '1', rowId: 'id1', timeEpochMs: 1 }),
        makeLog({ uid: '2', rowId: 'id2', timeEpochMs: 1 }),
        makeLog({ uid: '3', rowId: 'id3', timeEpochMs: 2 }),
        makeLog({ uid: '4', rowId: 'id3', timeEpochMs: 2 }),
      ];

      const panelState: Partial<ExplorePanelsState> = { logs: { id: 'not-included', visualisationType: 'logs' } };
      setup({ loading: false, panelState, logRows: rows });

      const row = screen.getAllByRole('row');
      await userEvent.hover(row[3]);

      const linkButton = screen.getByLabelText('Copy shortlink');
      await userEvent.click(linkButton);

      expect(createAndCopyShortLink).toHaveBeenCalledWith(
        expect.stringMatching(
          'range%22:%7B%22from%22:%222019-01-01T10:00:00.000Z%22,%22to%22:%221970-01-01T00:00:00.002Z%22%7D'
        )
      );
      expect(createAndCopyShortLink).toHaveBeenCalledWith(expect.stringMatching('visualisationType%22:%22logs'));
      config.featureToggles.logsInfiniteScrolling = featureToggleValue;
    });
  });

  describe('displayed fields', () => {
    it('should sync displayed fields from the URL', async () => {
      const panelState: Partial<ExplorePanelsState> = {
        logs: { id: 'not-included', visualisationType: 'logs', displayedFields: ['field'] },
      };
      const rows = [makeLog({ uid: '1', rowId: 'id1', timeEpochMs: 1, labels: { field: 'field value' } })];
      setup({ loading: false, panelState, logRows: rows });

      expect(await screen.findByText('field=field value')).toBeInTheDocument();
      expect(screen.queryByText(/log message/)).not.toBeInTheDocument();
    });
  });

  describe('with table visualisation', () => {
    let originalVisualisationTypeValue = config.featureToggles.logsExploreTableVisualisation;

    beforeAll(() => {
      originalVisualisationTypeValue = config.featureToggles.logsExploreTableVisualisation;
      config.featureToggles.logsExploreTableVisualisation = true;
    });

    afterAll(() => {
      config.featureToggles.logsExploreTableVisualisation = originalVisualisationTypeValue;
    });

    it('should show visualisation type radio group', () => {
      setup();
      const logsSection = screen.getByRole('radio', { name: 'Show results in table visualisation' });
      expect(logsSection).toBeInTheDocument();
    });

    it('should change visualisation to table on toggle (loki)', async () => {
      setup({});
      const logsSection = screen.getByRole('radio', { name: 'Show results in table visualisation' });
      await userEvent.click(logsSection);

      const table = screen.getByTestId('logRowsTable');
      expect(table).toBeInTheDocument();
    });

    it('should use default state from localstorage - table', async () => {
      localStorage.setItem(visualisationTypeKey, 'table');
      setup({});
      const table = await screen.findByTestId('logRowsTable');
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
      const logsSection = screen.getByRole('radio', { name: 'Show results in table visualisation' });
      await userEvent.click(logsSection);

      const table = screen.getByTestId('logRowsTable');
      expect(table).toBeInTheDocument();
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
