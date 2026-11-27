import { act, render, screen, waitFor } from '@testing-library/react';
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
import { LogsSortOrder } from '@grafana/schema';
import { extractFieldsTransformer } from 'app/features/transformers/extractFields/extractFields';
import { configureStore } from 'app/store/configureStore';

import { LokiQueryDirection } from '../../loki-helpers/types';
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
  getAppEvents: jest.fn(() => ({
    publish: jest.fn(),
  })),
  getDataSourceSrv: jest.fn(() => ({
    get: () => Promise.resolve(null),
  })),
  usePluginLinks: jest.fn().mockReturnValue({
    links: [],
    isLoading: false,
  }),
  usePluginComponent: jest.fn().mockReturnValue({
    component: null,
    isLoading: false,
  }),
}));

// Mock TableNG to disable virtualization, otherwise the lack of viewport in our testing env will cause the table to only render a single column
jest.mock('@grafana/ui/unstable', () => {
  const actual = jest.requireActual('@grafana/ui/unstable');
  const MockTableNG = actual.TableNG;
  return {
    ...actual,
    TableNG: (props: ComponentProps<typeof MockTableNG>) => <MockTableNG {...props} enableVirtualization={false} />,
  };
});

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

const logListMock = jest.fn();
jest.mock('app/features/logs/components/panel/LogList', () => {
  const actual = jest.requireActual('app/features/logs/components/panel/LogList');
  const { createElement } = jest.requireActual('react');
  return {
    ...actual,
    LogList: (props: ComponentProps<typeof actual.LogList>) => {
      logListMock(props);
      return createElement(actual.LogList, props);
    },
  };
});

const includeDroppedLogsMock = jest.fn();
jest.mock('./AdaptiveLogsIncludeDroppedLogs', () => {
  const actual = jest.requireActual('./AdaptiveLogsIncludeDroppedLogs');
  const { createElement } = jest.requireActual('react');
  return {
    ...actual,
    AdaptiveLogsIncludeDroppedLogs: (props: ComponentProps<typeof actual.AdaptiveLogsIncludeDroppedLogs>) => {
      includeDroppedLogsMock(props);
      return createElement(actual.AdaptiveLogsIncludeDroppedLogs, props);
    },
  };
});

const fakeChangePanelState = jest.fn().mockReturnValue({ type: 'fakeAction' });
jest.mock('../state/explorePane', () =>
  jest.requireActual('test/helpers/partialMock').partialMock(jest.requireActual('../state/explorePane'), {
    changePanelState: (exploreId: string, panel: 'logs', panelState: {} | ExploreLogsPanelState) => {
      return fakeChangePanelState(exploreId, panel, panelState);
    },
  })
);

const fakeChangeQueries = jest.fn().mockReturnValue({ type: 'fakeChangeQueries' });
const fakeRunQueries = jest.fn().mockReturnValue({ type: 'fakeRunQueries' });
jest.mock('../state/query', () =>
  jest.requireActual('test/helpers/partialMock').partialMock(jest.requireActual('../state/query'), {
    changeQueries: (args: { queries: DataQuery[]; exploreId: string | undefined }) => {
      return fakeChangeQueries(args);
    },
    runQueries: (args: { queries: DataQuery[]; exploreId: string | undefined }) => {
      return fakeRunQueries(args);
    },
  })
);

describe('Logs', () => {
  let originalHref = window.location.href;

  beforeEach(() => {
    setBooleanFlags({ logsPanelControls: false, 'adaptivelogs.enableTimeMachine': true });
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

  it.each([true, false])('passes infiniteScrollTop=%s to the log list according to the flag', async (flag) => {
    setBooleanFlags({ logsPanelControls: false, 'grafana.logsInfiniteScrollTop': flag });
    logListMock.mockClear();

    setup();

    expect(await screen.findByText('log message 3')).toBeInTheDocument();
    expect(logListMock).toHaveBeenLastCalledWith(expect.objectContaining({ infiniteScrollTop: flag }));
  });

  it('should render logs', async () => {
    setup();
    const logsSection = screen.getByTestId('logRows');
    expect(logsSection).toBeInTheDocument();
    expect(await screen.findByText('log message 3')).toBeInTheDocument();
    expect(screen.getByText('log message 2')).toBeInTheDocument();
    expect(screen.getByText('log message 1')).toBeInTheDocument();
  });

  it('passes a debounced renderedLogsWindow to AdaptiveLogsIncludeDroppedLogs', async () => {
    includeDroppedLogsMock.mockClear();
    setup();
    await screen.findByText('log message 3');

    const { onRenderedLogsChanged } = logListMock.mock.calls.at(-1)[0];
    act(() => {
      onRenderedLogsChanged({
        visibleStartIndex: 1,
        visibleStopIndex: 2,
        overscanStartIndex: 0,
        overscanStopIndex: 2,
      });
    });

    await waitFor(() =>
      expect(includeDroppedLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          renderedLogsWindow: { startRowIndex: 1, endRowIndex: 2, logsSortOrder: LogsSortOrder.Descending },
        })
      )
    );
  });

  it('coalesces rapid onRenderedLogsChanged calls into the last one', async () => {
    includeDroppedLogsMock.mockClear();
    setup();
    await screen.findByText('log message 3');

    const { onRenderedLogsChanged } = logListMock.mock.calls.at(-1)[0];
    act(() => {
      onRenderedLogsChanged({
        visibleStartIndex: 0,
        visibleStopIndex: 1,
        overscanStartIndex: 0,
        overscanStopIndex: 1,
      });
      onRenderedLogsChanged({
        visibleStartIndex: 1,
        visibleStopIndex: 2,
        overscanStartIndex: 0,
        overscanStopIndex: 2,
      });
    });

    await waitFor(() =>
      expect(includeDroppedLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          renderedLogsWindow: { startRowIndex: 1, endRowIndex: 2, logsSortOrder: LogsSortOrder.Descending },
        })
      )
    );
    expect(includeDroppedLogsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        renderedLogsWindow: expect.objectContaining({ startRowIndex: 0, endRowIndex: 1 }),
      })
    );
  });

  it('does not update renderedLogsWindow before the debounce window elapses', async () => {
    includeDroppedLogsMock.mockClear();
    setup();
    await screen.findByText('log message 3');

    const { onRenderedLogsChanged } = logListMock.mock.calls.at(-1)[0];
    act(() => {
      onRenderedLogsChanged({
        visibleStartIndex: 1,
        visibleStopIndex: 2,
        overscanStartIndex: 0,
        overscanStopIndex: 2,
      });
    });

    expect(includeDroppedLogsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ renderedLogsWindow: expect.objectContaining({ startRowIndex: 1 }) })
    );

    await waitFor(() =>
      expect(includeDroppedLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          renderedLogsWindow: { startRowIndex: 1, endRowIndex: 2, logsSortOrder: LogsSortOrder.Descending },
        })
      )
    );
  });

  it('cancels a pending debounced update when logsSortOrder changes', async () => {
    includeDroppedLogsMock.mockClear();
    setup();
    await screen.findByText('log message 3');

    const staleOnRenderedLogsChanged = logListMock.mock.calls.at(-1)[0].onRenderedLogsChanged;
    act(() => {
      staleOnRenderedLogsChanged({
        visibleStartIndex: 1,
        visibleStopIndex: 2,
        overscanStartIndex: 0,
        overscanStopIndex: 2,
      });
    });

    const { onLogOptionsChange } = logListMock.mock.calls.at(-1)[0];
    act(() => {
      onLogOptionsChange('sortOrder', LogsSortOrder.Ascending);
    });

    const freshOnRenderedLogsChanged = logListMock.mock.calls.at(-1)[0].onRenderedLogsChanged;
    act(() => {
      freshOnRenderedLogsChanged({
        visibleStartIndex: 0,
        visibleStopIndex: 1,
        overscanStartIndex: 0,
        overscanStopIndex: 1,
      });
    });

    await waitFor(() =>
      expect(includeDroppedLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          renderedLogsWindow: { startRowIndex: 0, endRowIndex: 1, logsSortOrder: LogsSortOrder.Ascending },
        })
      )
    );
    expect(includeDroppedLogsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        renderedLogsWindow: expect.objectContaining({ startRowIndex: 1, endRowIndex: 2 }),
      })
    );
  });

  it('cancels the pending debounced update on unmount', async () => {
    const { unmount } = setup();
    await screen.findByText('log message 3');

    const { onRenderedLogsChanged } = logListMock.mock.calls.at(-1)[0];
    const cancelSpy = jest.spyOn(onRenderedLogsChanged, 'cancel');

    unmount();

    expect(cancelSpy).toHaveBeenCalled();
  });

  it('clears renderedLogsWindow when switching away from the logs visualisation', async () => {
    includeDroppedLogsMock.mockClear();
    setup();
    await screen.findByText('log message 3');

    const { onRenderedLogsChanged } = logListMock.mock.calls.at(-1)[0];
    act(() => {
      onRenderedLogsChanged({
        visibleStartIndex: 1,
        visibleStopIndex: 2,
        overscanStartIndex: 0,
        overscanStopIndex: 2,
      });
    });
    await waitFor(() =>
      expect(includeDroppedLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          renderedLogsWindow: expect.objectContaining({ startRowIndex: 1, endRowIndex: 2 }),
        })
      )
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Table' }));

    await waitFor(() => expect(includeDroppedLogsMock.mock.calls.at(-1)[0].renderedLogsWindow).toBeUndefined());
  });

  it('updates renderedLogsWindow when logs changes even at the same indices (e.g. a query re-run)', async () => {
    includeDroppedLogsMock.mockClear();
    const dataFrame = getMockLokiFrame();
    const logs = [
      makeLog({ uid: '1', rowId: 'id1', timeEpochMs: 1 }),
      makeLog({ uid: '2', rowId: 'id2', timeEpochMs: 2 }),
      makeLog({ uid: '3', rowId: 'id3', timeEpochMs: 3 }),
    ];
    const { rerender, store } = setup(undefined, dataFrame, logs);
    await screen.findByText('log message 3');

    const { onRenderedLogsChanged } = logListMock.mock.calls.at(-1)[0];
    act(() => {
      onRenderedLogsChanged(
        { visibleStartIndex: 1, visibleStopIndex: 2, overscanStartIndex: 0, overscanStopIndex: 2 },
        logs
      );
    });
    await waitFor(() =>
      expect(includeDroppedLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          renderedLogsWindow: expect.objectContaining({ startRowIndex: 1, endRowIndex: 2 }),
        })
      )
    );

    // A query re-run that produces the same number of rows (so react-window's own onItemsRendered
    // won't naturally re-fire - its memoization is keyed only on the index numbers, not content).
    const newLogs = [
      makeLog({ uid: '4', rowId: 'id4', timeEpochMs: 10 }),
      makeLog({ uid: '5', rowId: 'id5', timeEpochMs: 11 }),
      makeLog({ uid: '6', rowId: 'id6', timeEpochMs: 12 }),
    ];
    rerender(<Provider store={store}>{getComponent(undefined, dataFrame, newLogs)}</Provider>);

    await waitFor(() => {
      const window = includeDroppedLogsMock.mock.calls.at(-1)[0].renderedLogsWindow;
      expect(window).toBeDefined();
      expect(window.logs.some((log: LogRowModel) => log.uid === '1')).toBe(false);
      expect(window.logs.some((log: LogRowModel) => ['4', '5', '6'].includes(log.uid))).toBe(true);
    });
  });

  it('does not clear renderedLogsWindow when logs grows (e.g. loading more or live tailing)', async () => {
    includeDroppedLogsMock.mockClear();
    const dataFrame = getMockLokiFrame();
    const logs = [
      makeLog({ uid: '1', rowId: 'id1', timeEpochMs: 1 }),
      makeLog({ uid: '2', rowId: 'id2', timeEpochMs: 2 }),
      makeLog({ uid: '3', rowId: 'id3', timeEpochMs: 3 }),
    ];
    const { rerender, store } = setup(undefined, dataFrame, logs);
    await screen.findByText('log message 3');

    const { onRenderedLogsChanged } = logListMock.mock.calls.at(-1)[0];
    act(() => {
      onRenderedLogsChanged(
        { visibleStartIndex: 1, visibleStopIndex: 2, overscanStartIndex: 0, overscanStopIndex: 2 },
        logs
      );
    });
    await waitFor(() =>
      expect(includeDroppedLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          renderedLogsWindow: expect.objectContaining({ startRowIndex: 1, endRowIndex: 2 }),
        })
      )
    );

    // Same time range and queries, just more rows (e.g. "load more" or live tailing) - should not
    // be treated as a query reset.
    rerender(
      <Provider store={store}>
        {getComponent(undefined, dataFrame, [...logs, makeLog({ uid: '4', rowId: 'id4', timeEpochMs: 4 })])}
      </Provider>
    );

    expect(includeDroppedLogsMock.mock.calls.at(-1)[0].renderedLogsWindow).not.toBeUndefined();
  });

  it('reports a defined-but-empty window when nothing is visible, instead of leaving a stale one', async () => {
    includeDroppedLogsMock.mockClear();
    const dataFrame = getMockLokiFrame();
    const logs = [
      makeLog({ uid: '1', rowId: 'id1', timeEpochMs: 1 }),
      makeLog({ uid: '2', rowId: 'id2', timeEpochMs: 2 }),
      makeLog({ uid: '3', rowId: 'id3', timeEpochMs: 3 }),
    ];
    setup(undefined, dataFrame, logs);
    await screen.findByText('log message 3');

    const { onRenderedLogsChanged } = logListMock.mock.calls.at(-1)[0];
    act(() => {
      onRenderedLogsChanged(
        { visibleStartIndex: 1, visibleStopIndex: 2, overscanStartIndex: 0, overscanStopIndex: 2 },
        logs
      );
    });
    await waitFor(() =>
      expect(includeDroppedLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          renderedLogsWindow: expect.objectContaining({ startRowIndex: 1, endRowIndex: 2 }),
        })
      )
    );

    // Simulates InfiniteScroll reporting "nothing real visible" (e.g. an in-panel filter left
    // zero rows) - the window should become a defined-but-empty shape, not stay stuck at the
    // previous non-empty value.
    act(() => {
      onRenderedLogsChanged(undefined, []);
    });

    await waitFor(() =>
      expect(includeDroppedLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          renderedLogsWindow: expect.objectContaining({ startRowIndex: undefined, endRowIndex: undefined, logs: [] }),
        })
      )
    );
  });

  it('never sets up rendered-window tracking when the adaptivelogs.enableTimeMachine flag is disabled', async () => {
    setBooleanFlags({ logsPanelControls: false, 'adaptivelogs.enableTimeMachine': false });
    includeDroppedLogsMock.mockClear();
    setup();
    await screen.findByText('log message 3');

    expect(logListMock).toHaveBeenLastCalledWith(expect.objectContaining({ onRenderedLogsChanged: undefined }));
    expect(includeDroppedLogsMock).toHaveBeenLastCalledWith(expect.objectContaining({ renderedLogsWindow: undefined }));
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

  it('reports a defined-but-empty window when there is no data at all, not a stale one', async () => {
    includeDroppedLogsMock.mockClear();
    const dataFrame = getMockLokiFrame();
    const logs = [
      makeLog({ uid: '1', rowId: 'id1', timeEpochMs: 1 }),
      makeLog({ uid: '2', rowId: 'id2', timeEpochMs: 2 }),
      makeLog({ uid: '3', rowId: 'id3', timeEpochMs: 3 }),
    ];
    const { rerender, store } = setup(undefined, dataFrame, logs);
    await screen.findByText('log message 3');

    const { onRenderedLogsChanged } = logListMock.mock.calls.at(-1)[0];
    act(() => {
      onRenderedLogsChanged(
        { visibleStartIndex: 1, visibleStopIndex: 2, overscanStartIndex: 0, overscanStopIndex: 2 },
        logs
      );
    });
    await waitFor(() =>
      expect(includeDroppedLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          renderedLogsWindow: expect.objectContaining({ startRowIndex: 1, endRowIndex: 2 }),
        })
      )
    );

    // The query now returns zero rows - LogList unmounts entirely (hasData is false), so nothing
    // inside it could ever clear the stale window on its own.
    rerender(<Provider store={store}>{getComponent(undefined, dataFrame, [])}</Provider>);

    expect(includeDroppedLogsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        renderedLogsWindow: expect.objectContaining({ startRowIndex: undefined, endRowIndex: undefined, logs: [] }),
      })
    );
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

      expect(await screen.findByText('Selected fields')).toBeInTheDocument();
      expect(screen.queryByTestId('logRowsTable')).not.toBeInTheDocument();
    });

    it('should use default state from localstorage - table', async () => {
      localStorage.setItem(visualisationTypeKey, 'table');
      setup({});
      expect(await screen.findByText('Selected fields')).toBeInTheDocument();
      expect(screen.queryByTestId('logRowsTable')).not.toBeInTheDocument();
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

      expect(await screen.findByText('Selected fields')).toBeInTheDocument();
      expect(screen.queryByTestId('logRowsTable')).not.toBeInTheDocument();
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
      expect(await screen.findByText('Selected fields')).toBeInTheDocument();
      expect(screen.queryByTestId('logRowsTable')).not.toBeInTheDocument();
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
