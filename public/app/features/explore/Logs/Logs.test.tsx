import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps } from 'react';

import {
  DataFrame,
  EventBusSrv,
  ExploreLogsPanelState,
  ExplorePanelsState,
  LoadingState,
  LogLevel,
  LogRowModel,
  standardTransformersRegistry,
  toUtc,
  createDataFrame,
} from '@grafana/data';
import { organizeFieldsTransformer } from '@grafana/data/src/transformations/transformers/organize';
import { config } from '@grafana/runtime';
import store from 'app/core/store';
import { extractFieldsTransformer } from 'app/features/transformers/extractFields/extractFields';

import { Logs } from './Logs';
import { visualisationTypeKey } from './utils/logs';
import { getMockElasticFrame, getMockLokiFrame } from './utils/testMocks.test';

jest.mock('app/core/store', () => {
  return {
    getBool: jest.fn(),
    getObject: jest.fn((_a, b) => b),
    get: jest.fn(),
    set: jest.fn(),
  };
});

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

jest.mock('app/store/store', () => ({
  getState: jest.fn().mockReturnValue({
    explore: {
      panes: {
        left: {
          datasource: 'id',
          queries: [{ refId: 'A', expr: '', queryType: 'range', datasource: { type: 'loki', uid: 'id' } }],
          range: { raw: { from: 'now-1h', to: 'now' } },
        },
      },
    },
  }),
  dispatch: jest.fn(),
}));

const changePanelState = jest.fn();
jest.mock('../state/explorePane', () => ({
  ...jest.requireActual('../state/explorePane'),
  changePanelState: (exploreId: string, panel: 'logs', panelState: {} | ExploreLogsPanelState) => {
    return changePanelState(exploreId, panel, panelState);
  },
}));

describe('Logs', () => {
  let originalHref = window.location.href;

  beforeEach(() => {
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
    standardTransformersRegistry.setInit(() => {
      return transformers.map((t) => {
        return {
          id: t.id,
          aliasIds: t.aliasIds,
          name: t.name,
          transformation: t,
          description: t.description,
          editor: () => null,
        };
      });
    });
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
    return render(getComponent(partialProps, dataFrame ? dataFrame : getMockLokiFrame(), logs));
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
    render(
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
    );
    const button = screen.getByRole('button', {
      name: /scan for older logs/i,
    });
    button.click();
    expect(scanningStarted).toHaveBeenCalled();
  });

  it('should render a stop scanning button', () => {
    render(
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
    );

    expect(
      screen.getByRole('button', {
        name: /stop scan/i,
      })
    ).toBeInTheDocument();
  });

  it('should render a stop scanning button', () => {
    const scanningStopped = jest.fn();

    render(
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
  });

  describe('for permalinking', () => {
    it('should dispatch a `changePanelState` event without the id', () => {
      const panelState = { logs: { id: '1' } };
      const { rerender } = setup({ loading: false, panelState });

      rerender(getComponent({ loading: true, exploreId: 'right', panelState }));
      rerender(getComponent({ loading: false, exploreId: 'right', panelState }));

      expect(changePanelState).toHaveBeenCalledWith('right', 'logs', { logs: {} });
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
      const panelState: Partial<ExplorePanelsState> = { logs: { id: 'not-included', visualisationType: 'logs' } };
      const rows = [
        makeLog({ uid: '1', rowId: 'id1', timeEpochMs: 1 }),
        makeLog({ uid: '2', rowId: 'id2', timeEpochMs: 1 }),
        makeLog({ uid: '3', rowId: 'id3', timeEpochMs: 2 }),
        makeLog({ uid: '4', rowId: 'id3', timeEpochMs: 2 }),
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
      const oldGet = store.get;
      store.get = jest.fn().mockReturnValue('table');
      localStorage.setItem(visualisationTypeKey, 'table');
      setup({});
      const table = await screen.findByTestId('logRowsTable');
      expect(table).toBeInTheDocument();
      store.get = oldGet;
    });

    it('should use default state from localstorage - logs', async () => {
      const oldGet = store.get;
      store.get = jest.fn().mockReturnValue('logs');
      localStorage.setItem(visualisationTypeKey, 'logs');
      setup({});
      const table = await screen.findByTestId('logRows');
      expect(table).toBeInTheDocument();
      store.get = oldGet;
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
