import {
  addQueryRowAction,
  addResultsToCache,
  clearCache,
  cancelQueries,
  cancelQueriesAction,
  queryReducer,
  removeQueryRowAction,
  importQueries,
  runQueries,
  scanStartAction,
  scanStopAction,
} from './query';
import { ExploreId, ExploreItemState } from 'app/types';
import { interval, of } from 'rxjs';
import {
  ArrayVector,
  DataQueryResponse,
  DefaultTimeZone,
  MutableDataFrame,
  RawTimeRange,
  toUtc,
  PanelData,
  DataFrame,
  LoadingState,
  DataSourceApi,
  DataSourceJsonData,
  DataQuery,
} from '@grafana/data';
import { thunkTester } from 'test/core/thunk/thunkTester';
import { makeExplorePaneState } from './utils';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { configureStore } from '../../../store/configureStore';
import { setTimeSrv } from '../../dashboard/services/TimeSrv';
import Mock = jest.Mock;

const QUERY_KEY_REGEX = /Q-(?:[a-z0-9]+-){5}(?:[0-9]+)/;
const t = toUtc();
const testRange = {
  from: t,
  to: t,
  raw: {
    from: t,
    to: t,
  },
};
const defaultInitialState = {
  user: {
    orgId: '1',
    timeZone: DefaultTimeZone,
  },
  explore: {
    [ExploreId.left]: {
      datasourceInstance: {
        query: jest.fn(),
        meta: {
          id: 'something',
        },
      },
      initialized: true,
      containerWidth: 1920,
      eventBridge: { emit: () => {} } as any,
      queries: [{ expr: 'test' }] as any[],
      range: testRange,
      refreshInterval: {
        label: 'Off',
        value: 0,
      },
      cache: [],
    },
  },
};

describe('runQueries', () => {
  it('should pass dataFrames to state even if there is error in response', async () => {
    setTimeSrv({
      init() {},
    } as any);
    const store = configureStore({
      ...(defaultInitialState as any),
    });
    (store.getState().explore[ExploreId.left].datasourceInstance?.query as Mock).mockReturnValueOnce(
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
    await store.dispatch(runQueries(ExploreId.left));
    expect(store.getState().explore[ExploreId.left].showMetrics).toBeTruthy();
    expect(store.getState().explore[ExploreId.left].graphResult).toBeDefined();
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

    expect(dispatchedActions).toEqual([scanStopAction({ exploreId }), cancelQueriesAction({ exploreId })]);
  });
});

describe('importing queries', () => {
  describe('when importing queries between the same type of data source', () => {
    it('remove datasource property from all of the queries', async () => {
      const store = configureStore({
        ...(defaultInitialState as any),
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            datasourceInstance: { name: 'testDs', type: 'postgres' },
          },
        },
      });

      await store.dispatch(
        importQueries(
          ExploreId.left,
          [
            { datasource: 'postgres1', refId: 'refId_A' },
            { datasource: 'postgres1', refId: 'refId_B' },
          ],
          { name: 'Postgres1', type: 'postgres' } as DataSourceApi<DataQuery, DataSourceJsonData, {}>,
          { name: 'Postgres2', type: 'postgres' } as DataSourceApi<DataQuery, DataSourceJsonData, {}>
        )
      );

      expect(store.getState().explore[ExploreId.left].queries[0]).toHaveProperty('refId', 'refId_A');
      expect(store.getState().explore[ExploreId.left].queries[1]).toHaveProperty('refId', 'refId_B');
      expect(store.getState().explore[ExploreId.left].queries[0]).not.toHaveProperty('datasource');
      expect(store.getState().explore[ExploreId.left].queries[1]).not.toHaveProperty('datasource');
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
        .givenReducer(queryReducer, ({
          queries: [],
        } as unknown) as ExploreItemState)
        .whenActionIsDispatched(
          addQueryRowAction({
            exploreId: ExploreId.left,
            query: { refId: 'A', key: 'mockKey' },
            index: 0,
          })
        )
        .thenStateShouldEqual(({
          queries: [{ refId: 'A', key: 'mockKey' }],
          queryKeys: ['mockKey-0'],
        } as unknown) as ExploreItemState);
    });
    it('removes a query row', () => {
      reducerTester<ExploreItemState>()
        .givenReducer(queryReducer, ({
          queries: [
            { refId: 'A', key: 'mockKey' },
            { refId: 'B', key: 'mockKey' },
          ],
          queryKeys: ['mockKey-0', 'mockKey-1'],
        } as unknown) as ExploreItemState)
        .whenActionIsDispatched(
          removeQueryRowAction({
            exploreId: ExploreId.left,
            index: 0,
          })
        )
        .thenStatePredicateShouldEqual((resultingState: ExploreItemState) => {
          expect(resultingState.queries.length).toBe(1);
          expect(resultingState.queries[0].refId).toBe('A');
          expect(resultingState.queries[0].key).toMatch(QUERY_KEY_REGEX);
          expect(resultingState.queryKeys[0]).toMatch(QUERY_KEY_REGEX);
          return true;
        });
    });
    it('reassigns query refId after removing a query to keep queries in order', () => {
      reducerTester<ExploreItemState>()
        .givenReducer(queryReducer, ({
          queries: [{ refId: 'A' }, { refId: 'B' }, { refId: 'C' }],
          queryKeys: ['undefined-0', 'undefined-1', 'undefined-2'],
        } as unknown) as ExploreItemState)
        .whenActionIsDispatched(
          removeQueryRowAction({
            exploreId: ExploreId.left,
            index: 0,
          })
        )
        .thenStatePredicateShouldEqual((resultingState: ExploreItemState) => {
          expect(resultingState.queries.length).toBe(2);
          const queriesRefIds = resultingState.queries.map((query) => query.refId);
          const queriesKeys = resultingState.queries.map((query) => query.key);
          expect(queriesRefIds).toEqual(['A', 'B']);
          queriesKeys.forEach((queryKey) => {
            expect(queryKey).toMatch(QUERY_KEY_REGEX);
          });
          resultingState.queryKeys.forEach((queryKey) => {
            expect(queryKey).toMatch(QUERY_KEY_REGEX);
          });
          return true;
        });
    });
  });

  describe('caching', () => {
    it('should add response to cache', async () => {
      const store = configureStore({
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

      await store.dispatch(addResultsToCache(ExploreId.left));

      expect(store.getState().explore[ExploreId.left].cache).toEqual([
        { key: 'from=1621348027000&to=1621348050000', value: { series: [{ name: 'test name' }], state: 'Done' } },
      ]);
    });

    it('should not add response to cache if response is still loading', async () => {
      const store = configureStore({
        ...(defaultInitialState as any),
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            queryResponse: { series: [{ name: 'test name' }] as DataFrame[], state: LoadingState.Loading } as PanelData,
            absoluteRange: { from: 1621348027000, to: 1621348050000 },
          },
        },
      });

      await store.dispatch(addResultsToCache(ExploreId.left));

      expect(store.getState().explore[ExploreId.left].cache).toEqual([]);
    });

    it('should not add duplicate response to cache', async () => {
      const store = configureStore({
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

      await store.dispatch(addResultsToCache(ExploreId.left));

      expect(store.getState().explore[ExploreId.left].cache).toHaveLength(1);
      expect(store.getState().explore[ExploreId.left].cache).toEqual([
        { key: 'from=1621348027000&to=1621348050000', value: { series: [{ name: 'old test name' }], state: 'Done' } },
      ]);
    });

    it('should clear cache', async () => {
      const store = configureStore({
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

      await store.dispatch(clearCache(ExploreId.left));

      expect(store.getState().explore[ExploreId.left].cache).toEqual([]);
    });
  });
});
