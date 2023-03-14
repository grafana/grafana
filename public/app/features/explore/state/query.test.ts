import { snakeCase } from 'lodash';
import { EMPTY, interval, Observable, of } from 'rxjs';
import { thunkTester } from 'test/core/thunk/thunkTester';
import { assertIsDefined } from 'test/helpers/asserts';

import {
  ArrayVector,
  DataQueryResponse,
  DataSourceApi,
  DataSourceJsonData,
  DataSourcePluginMeta,
  DataSourceWithSupplementaryQueriesSupport,
  LoadingState,
  MutableDataFrame,
  RawTimeRange,
  SupplementaryQueryType,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { ExploreId, ExploreItemState, StoreState, ThunkDispatch } from 'app/types';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { configureStore } from '../../../store/configureStore';
import { setTimeSrv, TimeSrv } from '../../dashboard/services/TimeSrv';
import { supplementaryQueryTypes } from '../utils/supplementaryQueries';

import { createDefaultInitialState } from './helpers';
import { saveCorrelationsAction } from './main';
import {
  addQueryRowAction,
  addResultsToCache,
  cancelQueries,
  cancelQueriesAction,
  cleanSupplementaryQueryAction,
  clearCache,
  importQueries,
  queryReducer,
  runQueries,
  scanStartAction,
  scanStopAction,
  setSupplementaryQueryEnabled,
  addQueryRow,
  cleanSupplementaryQueryDataProviderAction,
  changeQueries,
} from './query';
import * as actions from './query';
import { makeExplorePaneState } from './utils';

const { testRange, defaultInitialState } = createDefaultInitialState();

const exploreId = ExploreId.left;
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
    type: 'mysql',
    uid: 'ds2',
    getRef: () => {
      return { type: 'mysql', uid: 'ds2' };
    },
  } as DataSourceApi<DataQuery, DataSourceJsonData, {}>,
];

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  ...jest.requireActual('app/features/dashboard/services/TimeSrv'),
  getTimeSrv: () => ({
    init: jest.fn(),
    timeRange: jest.fn().mockReturnValue({}),
  }),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    updateTimeRange: jest.fn(),
  }),
  getDataSourceSrv: () => {
    return {
      get: (ref?: DataSourceRef | string) => {
        if (!ref) {
          return datasources[0];
        }

        return (
          datasources.find((ds) => (typeof ref === 'string' ? ds.uid === ref : ds.uid === ref.uid)) || datasources[0]
        );
      },
    };
  },
  config: {
    featureToggles: { exploreMixedDatasource: false },
  },
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

async function setupStore(queries: DataQuery[], datasourceInstance: Partial<DataSourceApi>) {
  let dispatch: ThunkDispatch, getState: () => StoreState;

  const store: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
    ...defaultInitialState,
    explore: {
      [exploreId]: {
        ...defaultInitialState.explore[exploreId],
        queries: queries,
        datasourceInstance: datasourceInstance,
      },
    },
  } as unknown as Partial<StoreState>);

  dispatch = store.dispatch;
  getState = store.getState;

  setupQueryResponse(getState());

  await dispatch(addQueryRow(exploreId, 1));

  return getState;
}

describe('runQueries', () => {
  const setupTests = () => {
    setTimeSrv({ init() {} } as unknown as TimeSrv);
    return configureStore({
      ...defaultInitialState,
    } as unknown as Partial<StoreState>);
  };

  it('should pass dataFrames to state even if there is error in response', async () => {
    const { dispatch, getState } = setupTests();
    setupQueryResponse(getState());
    await dispatch(saveCorrelationsAction([]));
    await dispatch(runQueries(ExploreId.left));
    expect(getState().explore[ExploreId.left].showMetrics).toBeTruthy();
    expect(getState().explore[ExploreId.left].graphResult).toBeDefined();
  });

  it('should modify the request-id for all supplementary queries', () => {
    const { dispatch, getState } = setupTests();
    setupQueryResponse(getState());
    dispatch(saveCorrelationsAction([]));
    dispatch(runQueries(ExploreId.left));

    const state = getState().explore[ExploreId.left];
    expect(state.queryResponse.request?.requestId).toBe('explore_left');
    const datasource = state.datasourceInstance as unknown as DataSourceWithSupplementaryQueriesSupport<DataQuery>;
    for (const type of supplementaryQueryTypes) {
      expect(datasource.getDataProvider).toHaveBeenCalledWith(
        type,
        expect.objectContaining({
          requestId: `explore_left_${snakeCase(type)}`,
        })
      );
    }
  });

  it('should set state to done if query completes without emitting', async () => {
    const { dispatch, getState } = setupTests();
    const leftDatasourceInstance = assertIsDefined(getState().explore[ExploreId.left].datasourceInstance);
    jest.mocked(leftDatasourceInstance.query).mockReturnValueOnce(EMPTY);
    await dispatch(saveCorrelationsAction([]));
    await dispatch(runQueries(ExploreId.left));
    await new Promise((resolve) => setTimeout(() => resolve(''), 500));
    expect(getState().explore[ExploreId.left].queryResponse.state).toBe(LoadingState.Done);
  });

  it('shows results only after correlations are loaded', async () => {
    const { dispatch, getState } = setupTests();
    setupQueryResponse(getState());
    await dispatch(runQueries(ExploreId.left));
    expect(getState().explore[ExploreId.left].graphResult).not.toBeDefined();
    await dispatch(saveCorrelationsAction([]));
    expect(getState().explore[ExploreId.left].graphResult).toBeDefined();
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
          supplementaryQueries: {
            [SupplementaryQueryType.LogsVolume]: { enabled: true },
            [SupplementaryQueryType.LogsSample]: { enabled: true },
          },
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
      cleanSupplementaryQueryDataProviderAction({ exploreId, type: SupplementaryQueryType.LogsVolume }),
      cleanSupplementaryQueryAction({ exploreId, type: SupplementaryQueryType.LogsVolume }),
      cleanSupplementaryQueryDataProviderAction({ exploreId, type: SupplementaryQueryType.LogsSample }),
      cleanSupplementaryQueryAction({ exploreId, type: SupplementaryQueryType.LogsSample }),
    ]);
  });
});

describe('changeQueries', () => {
  // Due to how spyOn works (it removes `type`, `match` and `toString` from the spied function, on which we rely on in the reducer),
  // we are repeating the following tests twice, once to chck the resulting state and once to check that the correct actions are dispatched.
  describe('calls the correct actions', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });
    it('should import queries when datasource is changed', async () => {
      jest.spyOn(actions, 'importQueries');
      jest.spyOn(actions, 'changeQueriesAction');

      const originalQueries = [{ refId: 'A', datasource: datasources[0].getRef() }];

      const { dispatch } = configureStore({
        ...defaultInitialState,
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            datasourceInstance: datasources[0],
            queries: originalQueries,
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(
        changeQueries({
          queries: [{ refId: 'A', datasource: datasources[1].getRef() }],
          exploreId: ExploreId.left,
        })
      );

      expect(actions.changeQueriesAction).not.toHaveBeenCalled();
      expect(actions.importQueries).toHaveBeenCalledWith(
        ExploreId.left,
        originalQueries,
        datasources[0],
        datasources[1],
        originalQueries[0].refId
      );
    });

    it('should not import queries when datasource is not changed', async () => {
      jest.spyOn(actions, 'importQueries');
      jest.spyOn(actions, 'changeQueriesAction');

      const { dispatch } = configureStore({
        ...defaultInitialState,
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            datasourceInstance: datasources[0],
            queries: [{ refId: 'A', datasource: datasources[0].getRef() }],
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(
        changeQueries({
          queries: [{ refId: 'A', datasource: datasources[0].getRef(), queryType: 'someValue' }],
          exploreId: ExploreId.left,
        })
      );

      expect(actions.changeQueriesAction).toHaveBeenCalled();
      expect(actions.importQueries).not.toHaveBeenCalled();
    });
  });

  describe('correctly modifies the state', () => {
    it('should import queries when datasource is changed', async () => {
      const originalQueries = [{ refId: 'A', datasource: datasources[0].getRef() }];

      const { dispatch, getState } = configureStore({
        ...defaultInitialState,
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            datasourceInstance: datasources[0],
            queries: originalQueries,
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(
        changeQueries({
          queries: [{ refId: 'A', datasource: datasources[1].getRef() }],
          exploreId: ExploreId.left,
        })
      );

      expect(getState().explore[ExploreId.left].queries[0]).toHaveProperty('refId', 'A');
      expect(getState().explore[ExploreId.left].queries[0]).toHaveProperty('datasource', datasources[1].getRef());
    });

    it('should not import queries when datasource is not changed', async () => {
      const { dispatch, getState } = configureStore({
        ...defaultInitialState,
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            datasourceInstance: datasources[0],
            queries: [{ refId: 'A', datasource: datasources[0].getRef() }],
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(
        changeQueries({
          queries: [{ refId: 'A', datasource: datasources[0].getRef(), queryType: 'someValue' }],
          exploreId: ExploreId.left,
        })
      );

      expect(getState().explore[ExploreId.left].queries[0]).toHaveProperty('refId', 'A');
      expect(getState().explore[ExploreId.left].queries[0]).toHaveProperty('datasource', datasources[0].getRef());
      expect(getState().explore[ExploreId.left].queries[0]).toEqual({
        refId: 'A',
        datasource: datasources[0].getRef(),
        queryType: 'someValue',
      });
    });
  });
});

describe('importing queries', () => {
  describe('when importing queries between the same type of data source', () => {
    it('remove datasource property from all of the queries', async () => {
      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...defaultInitialState,
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            datasourceInstance: datasources[0],
          },
        },
      } as unknown as Partial<StoreState>);

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

describe('adding new query rows', () => {
  describe('with mixed datasources disabled', () => {
    it('should add query row when there is not yet a row and meta.mixed === true (impossible in UI)', async () => {
      const queries: DataQuery[] = [];
      const datasourceInstance = {
        query: jest.fn(),
        getRef: () => {
          return { type: 'loki', uid: 'uid-loki' };
        },
        meta: {
          id: 'mixed',
          mixed: true,
        } as unknown as DataSourcePluginMeta<{}>,
      };

      const getState = await setupStore(queries, datasourceInstance);

      expect(getState().explore[exploreId].datasourceInstance?.meta?.id).toBe('mixed');
      expect(getState().explore[exploreId].datasourceInstance?.meta?.mixed).toBe(true);
      expect(getState().explore[exploreId].queries).toHaveLength(1);
      expect(getState().explore[exploreId].queryKeys).toEqual(['uid-loki-0']);
    });
    it('should add query row when there is not yet a row and meta.mixed === false', async () => {
      const queries: DataQuery[] = [];
      const datasourceInstance = {
        query: jest.fn(),
        getRef: () => {
          return { type: 'loki', uid: 'uid-loki' };
        },
        meta: {
          id: 'loki',
          mixed: false,
        } as unknown as DataSourcePluginMeta<{}>,
      };

      const getState = await setupStore(queries, datasourceInstance);

      expect(getState().explore[exploreId].datasourceInstance?.meta?.id).toBe('loki');
      expect(getState().explore[exploreId].datasourceInstance?.meta?.mixed).toBe(false);
      expect(getState().explore[exploreId].queries).toHaveLength(1);
      expect(getState().explore[exploreId].queryKeys).toEqual(['uid-loki-0']);
    });

    it('should add another query row if there are two rows already', async () => {
      const queries = [
        {
          datasource: { type: 'loki', uid: 'ds3' },
          refId: 'C',
        },
        {
          datasource: { type: 'loki', uid: 'ds4' },
          refId: 'D',
        },
      ];
      const datasourceInstance = {
        query: jest.fn(),
        getRef: jest.fn(),
        meta: {
          id: 'loki',
          mixed: false,
        } as unknown as DataSourcePluginMeta<{}>,
      };
      const getState = await setupStore(queries, datasourceInstance);

      expect(getState().explore[exploreId].datasourceInstance?.meta?.id).toBe('loki');
      expect(getState().explore[exploreId].datasourceInstance?.meta?.mixed).toBe(false);
      expect(getState().explore[exploreId].queries).toHaveLength(3);
      expect(getState().explore[exploreId].queryKeys).toEqual(['ds3-0', 'ds4-1', 'ds4-2']);
    });
  });
  describe('with mixed datasources enabled', () => {
    beforeEach(() => {
      config.featureToggles.exploreMixedDatasource = true;
    });

    afterEach(() => {
      config.featureToggles.exploreMixedDatasource = false;
    });

    it('should add query row whith root ds (without overriding the default ds) when there is not yet a row', async () => {
      const queries: DataQuery[] = [];
      const datasourceInstance = {
        query: jest.fn(),
        getRef: jest.fn(),
        meta: {
          id: 'mixed',
          mixed: true,
        } as unknown as DataSourcePluginMeta<{}>,
      };

      const getState = await setupStore(queries, datasourceInstance);

      expect(getState().explore[exploreId].datasourceInstance?.meta?.id).toBe('mixed');
      expect(getState().explore[exploreId].datasourceInstance?.meta?.mixed).toBe(true);
      expect(getState().explore[exploreId].queries).toHaveLength(1);
      expect(getState().explore[exploreId].queries[0]?.datasource?.type).toBe('postgres');
      expect(getState().explore[exploreId].queryKeys).toEqual(['ds1-0']);
    });

    it('should add query row whith root ds (with overriding the default ds) when there is not yet a row', async () => {
      const queries: DataQuery[] = [];
      const datasourceInstance = {
        query: jest.fn(),
        getRef: () => {
          return { type: 'loki', uid: 'uid-loki' };
        },
        meta: {
          id: 'loki',
          mixed: false,
        } as unknown as DataSourcePluginMeta<{}>,
      };

      const getState = await setupStore(queries, datasourceInstance);

      expect(getState().explore[exploreId].datasourceInstance?.meta?.id).toBe('loki');
      expect(getState().explore[exploreId].datasourceInstance?.meta?.mixed).toBe(false);
      expect(getState().explore[exploreId].queries).toHaveLength(1);
      expect(getState().explore[exploreId].queries[0]?.datasource?.type).toBe('loki');
      expect(getState().explore[exploreId].queryKeys).toEqual(['uid-loki-0']);
    });

    it('should add another query row if there are two rows already (impossible in UI)', async () => {
      const queries = [
        {
          datasource: { type: 'postgres', uid: 'ds3' },
          refId: 'C',
        },
        {
          datasource: { type: 'loki', uid: 'ds4' },
          refId: 'D',
        },
      ];
      const datasourceInstance = {
        query: jest.fn(),
        getRef: jest.fn(),
        meta: {
          // datasourceInstance.meta.id is set to postgres because it's the default datasource
          id: 'postgres',
          mixed: false,
        } as unknown as DataSourcePluginMeta<{}>,
      };

      const getState = await setupStore(queries, datasourceInstance);

      expect(getState().explore[exploreId].datasourceInstance?.meta?.id).toBe('postgres');
      expect(getState().explore[exploreId].datasourceInstance?.meta?.mixed).toBe(false);
      expect(getState().explore[exploreId].queries).toHaveLength(3);
      expect(getState().explore[exploreId].queries[2]?.datasource?.type).toBe('loki');
      expect(getState().explore[exploreId].queryKeys).toEqual(['ds3-0', 'ds4-1', 'ds4-2']);
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
    it('should add query row when there is no query row yet', () => {
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
    it('should add query row when there is already one query row', () => {
      reducerTester<ExploreItemState>()
        .givenReducer(queryReducer, {
          queries: [{ refId: 'A', key: 'initialRow', datasource: { type: 'loki' } }],
        } as unknown as ExploreItemState)
        .whenActionIsDispatched(
          addQueryRowAction({
            exploreId: ExploreId.left,
            query: { refId: 'B', key: 'mockKey', datasource: { type: 'loki' } },
            index: 0,
          })
        )
        .thenStateShouldEqual({
          queries: [
            { refId: 'A', key: 'initialRow', datasource: { type: 'loki' } },
            { refId: 'B', key: 'mockKey', datasource: { type: 'loki' } },
          ],
          queryKeys: ['initialRow-0', 'mockKey-1'],
        } as unknown as ExploreItemState);
    });
  });

  describe('caching', () => {
    it('should add response to cache', async () => {
      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...defaultInitialState,
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            queryResponse: {
              series: [{ name: 'test name' }],
              state: LoadingState.Done,
            },
            absoluteRange: { from: 1621348027000, to: 1621348050000 },
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(addResultsToCache(ExploreId.left));

      expect(getState().explore[ExploreId.left].cache).toEqual([
        { key: 'from=1621348027000&to=1621348050000', value: { series: [{ name: 'test name' }], state: 'Done' } },
      ]);
    });

    it('should not add response to cache if response is still loading', async () => {
      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...defaultInitialState,
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            queryResponse: { series: [{ name: 'test name' }], state: LoadingState.Loading },
            absoluteRange: { from: 1621348027000, to: 1621348050000 },
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(addResultsToCache(ExploreId.left));

      expect(getState().explore[ExploreId.left].cache).toEqual([]);
    });

    it('should not add duplicate response to cache', async () => {
      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...defaultInitialState,
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            queryResponse: {
              series: [{ name: 'test name' }],
              state: LoadingState.Done,
            },
            absoluteRange: { from: 1621348027000, to: 1621348050000 },
            cache: [
              {
                key: 'from=1621348027000&to=1621348050000',
                value: { series: [{ name: 'old test name' }], state: LoadingState.Done },
              },
            ],
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(addResultsToCache(ExploreId.left));

      expect(getState().explore[ExploreId.left].cache).toHaveLength(1);
      expect(getState().explore[ExploreId.left].cache).toEqual([
        { key: 'from=1621348027000&to=1621348050000', value: { series: [{ name: 'old test name' }], state: 'Done' } },
      ]);
    });

    it('should clear cache', async () => {
      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...defaultInitialState,
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
      } as unknown as Partial<StoreState>);

      await dispatch(clearCache(ExploreId.left));

      expect(getState().explore[ExploreId.left].cache).toEqual([]);
    });
  });

  describe('supplementary queries', () => {
    let dispatch: ThunkDispatch,
      getState: () => StoreState,
      unsubscribes: Function[],
      mockDataProvider: () => Observable<DataQueryResponse>;

    beforeEach(() => {
      unsubscribes = [];
      mockDataProvider = () => {
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
        ...defaultInitialState,
        explore: {
          [ExploreId.left]: {
            ...defaultInitialState.explore[ExploreId.left],
            datasourceInstance: {
              query: jest.fn(),
              getRef: jest.fn(),
              meta: {
                id: 'something',
              },
              getDataProvider: () => {
                return mockDataProvider();
              },
              getSupportedSupplementaryQueryTypes: () => [
                SupplementaryQueryType.LogsVolume,
                SupplementaryQueryType.LogsSample,
              ],
              getSupplementaryQuery: jest.fn(),
            },
          },
        },
      } as unknown as Partial<StoreState>);

      dispatch = store.dispatch;
      getState = store.getState;

      setupQueryResponse(getState());
    });

    it('should cancel any unfinished supplementary queries when a new query is run', async () => {
      dispatch(runQueries(ExploreId.left));
      // first query is run automatically
      // loading in progress - subscriptions for both supplementary queries are created, not cleaned up yet
      expect(unsubscribes).toHaveLength(2);
      expect(unsubscribes[0]).not.toBeCalled();
      expect(unsubscribes[1]).not.toBeCalled();

      setupQueryResponse(getState());
      dispatch(runQueries(ExploreId.left));
      // a new query is run while supplementary queries are not resolve yet...
      expect(unsubscribes[0]).toBeCalled();
      expect(unsubscribes[1]).toBeCalled();
      // first subscriptions are cleaned up, a new subscriptions are created automatically
      expect(unsubscribes).toHaveLength(4);
      expect(unsubscribes[2]).not.toBeCalled();
      expect(unsubscribes[3]).not.toBeCalled();
    });

    it('should cancel all supported supplementary queries when the main query is canceled', () => {
      dispatch(runQueries(ExploreId.left));
      expect(unsubscribes).toHaveLength(2);
      expect(unsubscribes[0]).not.toBeCalled();
      expect(unsubscribes[1]).not.toBeCalled();

      dispatch(cancelQueries(ExploreId.left));
      expect(unsubscribes).toHaveLength(2);
      expect(unsubscribes[0]).toBeCalled();
      expect(unsubscribes[1]).toBeCalled();

      for (const type of supplementaryQueryTypes) {
        expect(getState().explore[ExploreId.left].supplementaryQueries[type].data).toBeUndefined();
        expect(getState().explore[ExploreId.left].supplementaryQueries[type].dataProvider).toBeUndefined();
      }
    });

    it('should load supplementary queries after running the query', () => {
      dispatch(runQueries(ExploreId.left));
      expect(unsubscribes).toHaveLength(2);
    });

    it('should clean any incomplete supplementary queries data when main query is canceled', () => {
      mockDataProvider = () => {
        return of({ state: LoadingState.Loading, error: undefined, data: [] });
      };
      dispatch(runQueries(ExploreId.left));

      for (const type of supplementaryQueryTypes) {
        expect(getState().explore[ExploreId.left].supplementaryQueries[type].data).toBeDefined();
        expect(getState().explore[ExploreId.left].supplementaryQueries[type].data!.state).toBe(LoadingState.Loading);
        expect(getState().explore[ExploreId.left].supplementaryQueries[type].dataProvider).toBeDefined();
      }
      for (const type of supplementaryQueryTypes) {
        expect(getState().explore[ExploreId.left].supplementaryQueries[type].data).toBeDefined();
        expect(getState().explore[ExploreId.left].supplementaryQueries[type].data!.state).toBe(LoadingState.Loading);
        expect(getState().explore[ExploreId.left].supplementaryQueries[type].dataProvider).toBeDefined();
      }

      dispatch(cancelQueries(ExploreId.left));
      for (const type of supplementaryQueryTypes) {
        expect(getState().explore[ExploreId.left].supplementaryQueries[type].data).toBeUndefined();
        expect(getState().explore[ExploreId.left].supplementaryQueries[type].data).toBeUndefined();
      }
    });

    it('keeps complete supplementary data when main query is canceled', async () => {
      mockDataProvider = () => {
        return of(
          { state: LoadingState.Loading, error: undefined, data: [] },
          { state: LoadingState.Done, error: undefined, data: [{}] }
        );
      };
      dispatch(runQueries(ExploreId.left));

      for (const types of supplementaryQueryTypes) {
        expect(getState().explore[ExploreId.left].supplementaryQueries[types].data).toBeDefined();
        expect(getState().explore[ExploreId.left].supplementaryQueries[types].data!.state).toBe(LoadingState.Done);
        expect(getState().explore[ExploreId.left].supplementaryQueries[types].dataProvider).toBeDefined();
      }

      dispatch(cancelQueries(ExploreId.left));

      for (const types of supplementaryQueryTypes) {
        expect(getState().explore[ExploreId.left].supplementaryQueries[types].data).toBeDefined();
        expect(getState().explore[ExploreId.left].supplementaryQueries[types].data!.state).toBe(LoadingState.Done);
        expect(getState().explore[ExploreId.left].supplementaryQueries[types].dataProvider).toBeUndefined();
      }
    });

    it('do not load disabled supplementary query data', () => {
      mockDataProvider = () => {
        return of({ state: LoadingState.Done, error: undefined, data: [{}] });
      };
      // turn logs volume off (but keep logs sample on)
      dispatch(setSupplementaryQueryEnabled(ExploreId.left, false, SupplementaryQueryType.LogsVolume));
      expect(getState().explore[ExploreId.left].supplementaryQueries[SupplementaryQueryType.LogsVolume].enabled).toBe(
        false
      );
      expect(getState().explore[ExploreId.left].supplementaryQueries[SupplementaryQueryType.LogsSample].enabled).toBe(
        true
      );

      // verify that if we run a query, it will: 1) not do logs volume, 2) do logs sample 3) provider will still be set for both
      dispatch(runQueries(ExploreId.left));

      expect(
        getState().explore[ExploreId.left].supplementaryQueries[SupplementaryQueryType.LogsVolume].data
      ).toBeUndefined();
      expect(
        getState().explore[ExploreId.left].supplementaryQueries[SupplementaryQueryType.LogsVolume].dataSubscription
      ).toBeUndefined();
      expect(
        getState().explore[ExploreId.left].supplementaryQueries[SupplementaryQueryType.LogsVolume].dataProvider
      ).toBeDefined();

      expect(
        getState().explore[ExploreId.left].supplementaryQueries[SupplementaryQueryType.LogsSample].data
      ).toBeDefined();
      expect(
        getState().explore[ExploreId.left].supplementaryQueries[SupplementaryQueryType.LogsSample].dataSubscription
      ).toBeDefined();
      expect(
        getState().explore[ExploreId.left].supplementaryQueries[SupplementaryQueryType.LogsSample].dataProvider
      ).toBeDefined();
    });

    it('load data of supplementary query that gets enabled', async () => {
      // first we start with both supplementary queries disabled
      dispatch(setSupplementaryQueryEnabled(ExploreId.left, false, SupplementaryQueryType.LogsVolume));
      dispatch(setSupplementaryQueryEnabled(ExploreId.left, false, SupplementaryQueryType.LogsSample));

      // runQueries sets up providers, but does not run queries
      dispatch(runQueries(ExploreId.left));
      expect(
        getState().explore[ExploreId.left].supplementaryQueries[SupplementaryQueryType.LogsVolume].dataProvider
      ).toBeDefined();
      expect(
        getState().explore[ExploreId.left].supplementaryQueries[SupplementaryQueryType.LogsSample].dataProvider
      ).toBeDefined();

      // we turn 1 supplementary query (logs volume) on
      dispatch(setSupplementaryQueryEnabled(ExploreId.left, true, SupplementaryQueryType.LogsVolume));

      // verify it was turned on
      expect(getState().explore[ExploreId.left].supplementaryQueries[SupplementaryQueryType.LogsVolume].enabled).toBe(
        true
      );
      // verify that other stay off
      expect(getState().explore[ExploreId.left].supplementaryQueries[SupplementaryQueryType.LogsSample].enabled).toBe(
        false
      );

      expect(
        getState().explore[ExploreId.left].supplementaryQueries[SupplementaryQueryType.LogsVolume].dataSubscription
      ).toBeDefined();

      expect(
        getState().explore[ExploreId.left].supplementaryQueries[SupplementaryQueryType.LogsSample].dataSubscription
      ).toBeUndefined();
    });
  });
});
