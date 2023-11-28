import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps } from 'react';

import {
  EventBusSrv,
  ExploreLogsPanelState,
  FieldType,
  LoadingState,
  LogLevel,
  LogRowModel,
  MutableDataFrame,
  standardTransformersRegistry,
  toUtc,
} from '@grafana/data';
import { organizeFieldsTransformer } from '@grafana/data/src/transformations/transformers/organize';
import { config } from '@grafana/runtime';
import { extractFieldsTransformer } from 'app/features/transformers/extractFields/extractFields';

import { Logs } from './Logs';

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

  const getComponent = (partialProps?: Partial<ComponentProps<typeof Logs>>, logs?: LogRowModel[]) => {
    const rows = [
      makeLog({ uid: '1', rowId: 'id1', timeEpochMs: 1 }),
      makeLog({ uid: '2', rowId: 'id2', timeEpochMs: 2 }),
      makeLog({ uid: '3', rowId: 'id3', timeEpochMs: 3 }),
    ];

    const testDataFrame = {
      fields: [
        {
          config: {},
          name: 'Time',
          type: FieldType.time,
          values: ['2019-01-01 10:00:00', '2019-01-01 11:00:00', '2019-01-01 12:00:00'],
        },
        {
          config: {},
          name: 'line',
          type: FieldType.string,
          values: ['log message 1', 'log message 2', 'log message 3'],
        },
        {
          config: {},
          name: 'labels',
          type: FieldType.other,
          typeInfo: {
            frame: 'json.RawMessage',
          },
          values: ['{"foo":"bar"}', '{"foo":"bar"}', '{"foo":"bar"}'],
        },
      ],
      length: 3,
    };
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
  const setup = (partialProps?: Partial<ComponentProps<typeof Logs>>, logs?: LogRowModel[]) => {
    return render(getComponent(partialProps, logs));
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

    describe('when `exploreScrollableLogsContainer` is set', () => {
      let featureToggle: boolean | undefined;
      beforeEach(() => {
        featureToggle = config.featureToggles.exploreScrollableLogsContainer;
        config.featureToggles.exploreScrollableLogsContainer = true;
      });
      afterEach(() => {
        config.featureToggles.exploreScrollableLogsContainer = featureToggle;
        jest.clearAllMocks();
      });

      it('should call `this.state.logsContainer.scroll`', () => {
        const scrollIntoViewSpy = jest.spyOn(window.HTMLElement.prototype, 'scrollIntoView');
        jest.spyOn(window.HTMLElement.prototype, 'scrollTop', 'get').mockReturnValue(920);
        const scrollSpy = jest.spyOn(window.HTMLElement.prototype, 'scroll');

        const logs = [];
        for (let i = 0; i < 50; i++) {
          logs.push(makeLog({ uid: `uid${i}`, rowId: `id${i}`, timeEpochMs: i }));
        }

        setup({ panelState: { logs: { id: 'uid47' } } }, logs);

        expect(scrollIntoViewSpy).toBeCalledTimes(1);
        // element.getBoundingClientRect().top will always be 0 for jsdom
        // calc will be `this.state.logsContainer.scrollTop - window.innerHeight / 2` -> 920 - 500 = 420
        expect(scrollSpy).toBeCalledWith({ behavior: 'smooth', top: 420 });
      });
    });

    describe('when `exploreScrollableLogsContainer` is not set', () => {
      let featureToggle: boolean | undefined;
      beforeEach(() => {
        featureToggle = config.featureToggles.exploreScrollableLogsContainer;
        config.featureToggles.exploreScrollableLogsContainer = false;
      });
      afterEach(() => {
        config.featureToggles.exploreScrollableLogsContainer = featureToggle;
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
          logs
        );

        // element.getBoundingClientRect().top will always be 0 for jsdom
        // calc will be `scrollElement.scrollTop - window.innerHeight / 2` -> 920 - 500 = 420
        expect(scrollElementMock.scroll).toBeCalledWith({ behavior: 'smooth', top: 420 });
      });
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
    setup({}, []);

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
      setup({ loading: false, panelState });

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

    it('should call createAndCopyShortLink on permalinkClick', async () => {
      const panelState = { logs: { id: 'not-included' } };
      setup({ loading: false, panelState });

      const row = screen.getAllByRole('row');
      await userEvent.hover(row[0]);

      const linkButton = screen.getByLabelText('Copy shortlink');
      await userEvent.click(linkButton);

      expect(createAndCopyShortLink).toHaveBeenCalledWith(
        'http://localhost:3000/explore?left=%7B%22datasource%22:%22%22,%22queries%22:%5B%7B%22refId%22:%22A%22,%22expr%22:%22%22,%22queryType%22:%22range%22,%22datasource%22:%7B%22type%22:%22loki%22,%22uid%22:%22id%22%7D%7D%5D,%22range%22:%7B%22from%22:%222019-01-01T10:00:00.000Z%22,%22to%22:%222019-01-01T16:00:00.000Z%22%7D,%22panelsState%22:%7B%22logs%22:%7B%22id%22:%221%22%7D%7D%7D'
      );
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

    it('should change visualisation to table on toggle', async () => {
      setup();
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
    dataFrame: new MutableDataFrame(),
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
