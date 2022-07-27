import { EMPTY, interval, Observable, of } from 'rxjs';
import { thunkTester } from 'test/core/thunk/thunkTester';
import { assertIsDefined } from 'test/helpers/asserts';

import {
  ArrayVector,
  DataFrame,
  DataQuery,
  DataQueryResponse,
  DataSourceApi,
  DataSourceJsonData,
  DataSourceWithLogsVolumeSupport,
  LoadingState,
  MutableDataFrame,
  PanelData,
  RawTimeRange,
} from '@grafana/data';
import { ExploreId, ExploreItemState, StoreState, ThunkDispatch } from 'app/types';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { configureStore } from '../../../store/configureStore';
import { setTimeSrv } from '../../dashboard/services/TimeSrv';

import { createDefaultInitialState } from './helpers';
import {
  addQueryRowAction,
  addResultsToCache,
  cancelQueries,
  cancelQueriesAction,
  cleanLogsVolumeAction,
  clearCache,
  importQueries,
  queryReducer,
  runQueries,
  scanStartAction,
  scanStopAction,
  storeLogsVolumeDataProviderAction,
} from './query';
import { makeExplorePaneState } from './utils';

const { testRange, defaultInitialState } = createDefaultInitialState();

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  ...jest.requireActual('app/features/dashboard/services/TimeSrv'),
  getTimeSrv: () => ({
    init: jest.fn(),
    timeRange: jest.fn().mockReturnValue({}),
  }),
}));

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getTemplateSrv: () => ({
    updateTimeRange: jest.fn(),
  }),
}));

function setupQueryResponse(state: StoreState) {
  const leftDatasourceInstance = assertIsDefined(state.explore[ExploreId.left].datasourceInstance);

  jest.mocked(leftDatasourceInstance.query).mockReturnValueOnce(
    of({
      error: { message: 'test error' },
      data: [
        new MutableDataFrame({
          fields: [{ name: 'test', values: new ArrayVector() }],
          meta: {
            preferredVisualisationType: 'graph',
          },
        }),
      ],
    } as DataQueryResponse)
  );
}

describe('runQueries', () => {
  it('should pass dataFrames to state even if there is error in response', async () => {
    setTimeSrv({ init() {} } as any);
    const { dispatch, getState } = configureStore({
      ...(defaultInitialState as any),
    });
    setupQueryResponse(getState());
    await dispatch(runQueries(ExploreId.left));
    expect(getState().explore[ExploreId.left].showMetrics).toBeTruthy();
    expect(getState().explore[ExploreId.left].graphResult).toBeDefined();
  });

  it('should modify the request-id for log-volume queries', async () => {
    setTimeSrv({ init() {} } as any);
    const { dispatch, getState } = configureStore({
      ...(defaultInitialState as any),
    });
    setupQueryResponse(getState());
    await dispatch(runQueries(ExploreId.left));

    const state = getState().explore[ExploreId.left];
    expect(state.queryResponse.request?.requestId).toBe('explore_left');
    const datasource = state.datasourceInstance as any as DataSourceWithLogsVolumeSupport<DataQuery>;
    expect(datasource.getLogsVolumeDataProvider).toBeCalledWith(
      expect.objectContaining({
        requestId: 'explore_left_log_volume',
      })
    );
  });

  it('should set state to done if query completes without emitting', async () => {
    setTimeSrv({ init() {} } as any);
    const { dispatch, getState } = configureStore({
      ...(defaultInitialState as any),
    });
    const leftDatasourceInstance = assertIsDefined(getState().explore[ExploreId.left].datasourceInstance);
    jest.mocked(leftDatasourceInstance.query).mockReturnValueOnce(EMPTY);
    await dispatch(runQueries(ExploreId.left));
    await new Promise((resolve) => setTimeout(() => resolve(''), 500));
    expect(getState().explore[ExploreId.left].queryResponse.state).toBe(LoadingState.Done);
  });
});

describe('running queries', () => {
  it('should cancel running query when cancelQueries is dispatched', async () => {
    const unsubscribable = interval(1000);
    unsubscribable.subscribe();
    const exploreId = ExploreId.left;
    const initialState = {
      explore: {
        [exploreId]: {
          datasourceInstance: { name: 'testDs' },
          initialized: true,
          loading: true,
          querySubscription: unsubscribable,
          queries: ['A'],
          range: testRange,
        },
      },

      user: {
        orgId: 'A',
      },
    };

    const dispatchedActions = await thunkTester(initialState)
      .givenThunk(cancelQueries)
      .whenThunkIsDispatched(exploreId);

    expect(dispatchedActions).toEqual([
      scanStopAction({ exploreId }),
      cancelQueriesAction({ exploreId }),
      storeLogsVolumeDataProviderAction({ exploreId, logsVolumeDataProvider: undefined }),
      cleanLogsVolumeAction({ exploreId }),
    ]);
  });
});

describe('importing queries', () => {
  describe('when importing queries between the same type of data source', () => {
    it('remove datasource property from all of the queries', async () => {
      const datasources: DataSourceApi[] = [
        {
          name: 'testDs',
          type: 'postgres',
          uid: 'ds1',
          getRef: () => {
            return { type: 'postgres', uid: 'ds1' };
          },
        } as DataSourceApi<DataQuery, DataSourceJsonData, {}>,
        {
          name: 'testDs2',
          type: 'postgres',
          uid: 'ds2',
          getRef: () => {
            return { type: 'postgres', uid: 'ds2' };
          },
        } as DataSourceApi<DataQuery, DataSourceJsonData, {}>,
      ];

      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...(defaultInitialState as any),
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            datasourceInstance: datasources[0],
          },
        },
      });

      await dispatch(
        importQueries(
          ExploreId.left,
          [
            { datasource: { type: 'postgresql', uid: 'ds1' }, refId: 'refId_A' },
            { datasource: { type: 'postgresql', uid: 'ds1' }, refId: 'refId_B' },
          ],
          datasources[0],
          datasources[1]
        )
      );

      expect(getState().explore[ExploreId.left].queries[0]).toHaveProperty('refId', 'refId_A');
      expect(getState().explore[ExploreId.left].queries[1]).toHaveProperty('refId', 'refId_B');
      expect(getState().explore[ExploreId.left].queries[0]).toHaveProperty('datasource.uid', 'ds2');
      expect(getState().explore[ExploreId.left].queries[1]).toHaveProperty('datasource.uid', 'ds2');
    });
  });
});

describe('reducer', () => {
  describe('scanning', () => {
    it('should start scanning', () => {
      const initialState: ExploreItemState = {
        ...makeExplorePaneState(),
        scanning: false,
      };

      reducerTester<ExploreItemState>()
        .givenReducer(queryReducer, initialState)
        .whenActionIsDispatched(scanStartAction({ exploreId: ExploreId.left }))
        .thenStateShouldEqual({
          ...initialState,
          scanning: true,
        });
    });
    it('should stop scanning', () => {
      const initialState = {
        ...makeExplorePaneState(),
        scanning: true,
        scanRange: {} as RawTimeRange,
      };

      reducerTester<ExploreItemState>()
        .givenReducer(queryReducer, initialState)
        .whenActionIsDispatched(scanStopAction({ exploreId: ExploreId.left }))
        .thenStateShouldEqual({
          ...initialState,
          scanning: false,
          scanRange: undefined,
        });
    });
  });

  describe('query rows', () => {
    it('adds a new query row', () => {
      reducerTester<ExploreItemState>()
        .givenReducer(queryReducer, {
          queries: [],
        } as unknown as ExploreItemState)
        .whenActionIsDispatched(
          addQueryRowAction({
            exploreId: ExploreId.left,
            query: { refId: 'A', key: 'mockKey' },
            index: 0,
          })
        )
        .thenStateShouldEqual({
          queries: [{ refId: 'A', key: 'mockKey' }],
          queryKeys: ['mockKey-0'],
        } as unknown as ExploreItemState);
    });
  });

  describe('caching', () => {
    it('should add response to cache', async () => {
      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...(defaultInitialState as any),
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            queryResponse: {
              series: [{ name: 'test name' }] as DataFrame[],
              state: LoadingState.Done,
            } as PanelData,
            absoluteRange: { from: 1621348027000, to: 1621348050000 },
          },
        },
      });

      await dispatch(addResultsToCache(ExploreId.left));

      expect(getState().explore[ExploreId.left].cache).toEqual([
        { key: 'from=1621348027000&to=1621348050000', value: { series: [{ name: 'test name' }], state: 'Done' } },
      ]);
    });

    it('should not add response to cache if response is still loading', async () => {
      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...(defaultInitialState as any),
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            queryResponse: { series: [{ name: 'test name' }] as DataFrame[], state: LoadingState.Loading } as PanelData,
            absoluteRange: { from: 1621348027000, to: 1621348050000 },
          },
        },
      });

      await dispatch(addResultsToCache(ExploreId.left));

      expect(getState().explore[ExploreId.left].cache).toEqual([]);
    });

    it('should not add duplicate response to cache', async () => {
      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...(defaultInitialState as any),
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            queryResponse: {
              series: [{ name: 'test name' }] as DataFrame[],
              state: LoadingState.Done,
            } as PanelData,
            absoluteRange: { from: 1621348027000, to: 1621348050000 },
            cache: [
              {
                key: 'from=1621348027000&to=1621348050000',
                value: { series: [{ name: 'old test name' }], state: LoadingState.Done },
              },
            ],
          },
        },
      });

      await dispatch(addResultsToCache(ExploreId.left));

      expect(getState().explore[ExploreId.left].cache).toHaveLength(1);
      expect(getState().explore[ExploreId.left].cache).toEqual([
        { key: 'from=1621348027000&to=1621348050000', value: { series: [{ name: 'old test name' }], state: 'Done' } },
      ]);
    });

    it('should clear cache', async () => {
      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...(defaultInitialState as any),
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            cache: [
              {
                key: 'from=1621348027000&to=1621348050000',
                value: { series: [{ name: 'old test name' }], state: 'Done' },
              },
            ],
          },
        },
      });

      await dispatch(clearCache(ExploreId.left));

      expect(getState().explore[ExploreId.left].cache).toEqual([]);
    });
  });

  describe('log volume', () => {
    let dispatch: ThunkDispatch,
      getState: () => StoreState,
      unsubscribes: Function[],
      mockLogsVolumeDataProvider: () => Observable<DataQueryResponse>;

    beforeEach(() => {
      unsubscribes = [];
      mockLogsVolumeDataProvider = () => {
        return {
          subscribe: () => {
            const unsubscribe = jest.fn();
            unsubscribes.push(unsubscribe);
            return {
              unsubscribe,
            };
          },
        } as unknown as Observable<DataQueryResponse>;
      };

      const store: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...(defaultInitialState as any),
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            datasourceInstance: {
              query: jest.fn(),
              getRef: jest.fn(),
              meta: {
                id: 'something',
              },
              getLogsVolumeDataProvider: () => {
                return mockLogsVolumeDataProvider();
              },
            },
          },
        },
      });

      dispatch = store.dispatch;
      getState = store.getState;

      setupQueryResponse(getState());
    });

    it('should cancel any unfinished logs volume queries when a new query is run', async () => {
      await dispatch(runQueries(ExploreId.left));
      // first query is run automatically
      // loading in progress - one subscription created, not cleaned up yet
      expect(unsubscribes).toHaveLength(1);
      expect(unsubscribes[0]).not.toBeCalled();

      setupQueryResponse(getState());
      await dispatch(runQueries(ExploreId.left));
      // a new query is run while log volume query is not resolve yet...
      expect(unsubscribes[0]).toBeCalled();
      // first subscription is cleaned up, a new subscription is created automatically
      expect(unsubscribes).toHaveLength(2);
      expect(unsubscribes[1]).not.toBeCalled();
    });

    it('should cancel log volume query when the main query is canceled', async () => {
      await dispatch(runQueries(ExploreId.left));
      expect(unsubscribes).toHaveLength(1);
      expect(unsubscribes[0]).not.toBeCalled();

      await dispatch(cancelQueries(ExploreId.left));
      expect(unsubscribes).toHaveLength(1);
      expect(unsubscribes[0]).toBeCalled();

      expect(getState().explore[ExploreId.left].logsVolumeData).toBeUndefined();
      expect(getState().explore[ExploreId.left].logsVolumeDataProvider).toBeUndefined();
    });

    it('should load logs volume after running the query', async () => {
      await dispatch(runQueries(ExploreId.left));
      expect(unsubscribes).toHaveLength(1);
    });

    it('should clean any incomplete log volume data when main query is canceled', async () => {
      mockLogsVolumeDataProvider = () => {
        return of({ state: LoadingState.Loading, error: undefined, data: [] });
      };
      await dispatch(runQueries(ExploreId.left));

      expect(getState().explore[ExploreId.left].logsVolumeData).toBeDefined();
      expect(getState().explore[ExploreId.left].logsVolumeData!.state).toBe(LoadingState.Loading);
      expect(getState().explore[ExploreId.left].logsVolumeDataProvider).toBeDefined();

      await dispatch(cancelQueries(ExploreId.left));
      expect(getState().explore[ExploreId.left].logsVolumeData).toBeUndefined();
      expect(getState().explore[ExploreId.left].logsVolumeDataProvider).toBeUndefined();
    });

    it('keeps complete log volume data when main query is canceled', async () => {
      mockLogsVolumeDataProvider = () => {
        return of(
          { state: LoadingState.Loading, error: undefined, data: [] },
          { state: LoadingState.Done, error: undefined, data: [{}] }
        );
      };
      await dispatch(runQueries(ExploreId.left));

      expect(getState().explore[ExploreId.left].logsVolumeData).toBeDefined();
      expect(getState().explore[ExploreId.left].logsVolumeData!.state).toBe(LoadingState.Done);
      expect(getState().explore[ExploreId.left].logsVolumeDataProvider).toBeDefined();

      await dispatch(cancelQueries(ExploreId.left));
      expect(getState().explore[ExploreId.left].logsVolumeData).toBeDefined();
      expect(getState().explore[ExploreId.left].logsVolumeData!.state).toBe(LoadingState.Done);
      expect(getState().explore[ExploreId.left].logsVolumeDataProvider).toBeUndefined();
    });
  });
});
