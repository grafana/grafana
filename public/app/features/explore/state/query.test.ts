import { snakeCase } from 'lodash';
import { EMPTY, interval, Observable, of } from 'rxjs';
import { thunkTester } from 'test/core/thunk/thunkTester';
import { assertIsDefined } from 'test/helpers/asserts';

import {
  DataQueryRequest,
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
import { DataQuery, DataSourceRef } from '@grafana/schema';
import config from 'app/core/config';
import { queryLogsSample, queryLogsVolume } from 'app/features/logs/logsModel';
import { ExploreItemState } from 'app/types/explore';
import { createAsyncThunk, StoreState, ThunkDispatch } from 'app/types/store';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import * as richHistory from '../../../core/utils/richHistory';
import { configureStore } from '../../../store/configureStore';
import { setTimeSrv, TimeSrv } from '../../dashboard/services/TimeSrv';
import { makeLogs } from '../mocks/makeLogs';
import { supplementaryQueryTypes } from '../utils/supplementaryQueries';

import { saveCorrelationsAction } from './explorePane';
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
  clearLogs,
  queryStreamUpdatedAction,
  QueryEndedPayload,
  changeQueries,
} from './query';
import * as actions from './query';
import { createDefaultInitialState } from './testHelpers';
import { makeExplorePaneState } from './utils';

jest.mock('app/features/logs/logsModel');

const { testRange, defaultInitialState } = createDefaultInitialState();

const exploreId = 'left';
const cleanUpMock = jest.fn();
const datasources: DataSourceApi[] = [
  {
    name: 'testDs',
    type: 'postgres',
    uid: 'ds1',
    getRef: () => {
      return { type: 'postgres', uid: 'ds1' };
    },
    filterQuery: (query: DataQuery) => {
      return query.key === 'true';
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
}));

function setupQueryResponse(state: StoreState) {
  const leftDatasourceInstance = assertIsDefined(state.explore.panes.left!.datasourceInstance);

  jest.mocked(leftDatasourceInstance.query).mockReturnValueOnce(
    of({
      error: { message: 'test error' },
      data: [
        new MutableDataFrame({
          fields: [{ name: 'test', values: [] }],
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
      panes: {
        [exploreId]: {
          ...defaultInitialState.explore.panes[exploreId],
          queries: queries,
          datasourceInstance: datasourceInstance,
        },
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

  beforeEach(() => {
    config.queryHistoryEnabled = false;
    jest.clearAllMocks();
  });

  it('should pass dataFrames to state even if there is error in response', async () => {
    const { dispatch, getState } = setupTests();
    setupQueryResponse(getState());

    await dispatch(saveCorrelationsAction({ exploreId: 'left', correlations: [] }));
    await dispatch(runQueries({ exploreId: 'left' }));
    expect(getState().explore.panes.left!.showMetrics).toBeTruthy();
    expect(getState().explore.panes.left!.graphResult).toBeDefined();
  });

  it('should modify the request-id for all supplementary queries', async () => {
    const { dispatch, getState } = setupTests();
    setupQueryResponse(getState());
    dispatch(saveCorrelationsAction({ exploreId: 'left', correlations: [] }));
    await dispatch(runQueries({ exploreId: 'left' }));

    const state = getState().explore.panes.left!;
    expect(state.queryResponse.request?.requestId).toBe('explore_left');
    const datasource = state.datasourceInstance as unknown as DataSourceWithSupplementaryQueriesSupport<DataQuery>;
    for (const type of supplementaryQueryTypes) {
      expect(datasource.getDataProvider).toHaveBeenCalledWith(
        type,
        expect.objectContaining({
          requestId: `explore_left_${snakeCase(type)}_0`,
        })
      );
    }
  });

  it('should set state to done if query completes without emitting', async () => {
    const { dispatch, getState } = setupTests();
    const leftDatasourceInstance = assertIsDefined(getState().explore.panes.left!.datasourceInstance);
    jest.mocked(leftDatasourceInstance.query).mockReturnValueOnce(EMPTY);
    await dispatch(saveCorrelationsAction({ exploreId: 'left', correlations: [] }));
    await dispatch(runQueries({ exploreId: 'left' }));
    await new Promise((resolve) => setTimeout(() => resolve(''), 500));
    expect(getState().explore.panes.left!.queryResponse.state).toBe(LoadingState.Done);
  });

  it('shows results only after correlations are loaded', async () => {
    const { dispatch, getState } = setupTests();
    setupQueryResponse(getState());
    await dispatch(runQueries({ exploreId: 'left' }));
    expect(getState().explore.panes.left!.graphResult).not.toBeDefined();
    await dispatch(saveCorrelationsAction({ exploreId: 'left', correlations: [] }));
    expect(getState().explore.panes.left!.graphResult).toBeDefined();
  });

  it('should add history items to both local and remote storage with the flag enabled', async () => {
    config.queryHistoryEnabled = true;
    const { dispatch } = setupTests();
    jest.spyOn(richHistory, 'addToRichHistory');
    await dispatch(runQueries({ exploreId: 'left' }));
    expect((richHistory.addToRichHistory as jest.Mock).mock.calls).toHaveLength(2);
    expect((richHistory.addToRichHistory as jest.Mock).mock.calls[0][0].localOverride).toBeTruthy();
    expect((richHistory.addToRichHistory as jest.Mock).mock.calls[1][0].localOverride).toBeFalsy();
  });

  it('should add history items to local storage only with the flag disabled', async () => {
    const { dispatch } = setupTests();
    jest.spyOn(richHistory, 'addToRichHistory');
    await dispatch(runQueries({ exploreId: 'left' }));
    expect((richHistory.addToRichHistory as jest.Mock).mock.calls).toHaveLength(1);
    expect((richHistory.addToRichHistory as jest.Mock).mock.calls[0][0].localOverride).toBeTruthy();
  });

  /* the next two tests are for ensuring the query datasource's filterQuery function stops queries
    from being saved to rich history. We do that by setting a fake datasource in this test (datasources[0])
    to filter queries off their key value

    datasources[1] does not have filterQuery defined
  */
  it('with filterQuery defined, should not save filtered out queries to history', async () => {
    const { dispatch } = configureStore({
      ...defaultInitialState,
      explore: {
        panes: {
          left: {
            ...defaultInitialState.explore.panes.left,
            datasourceInstance: datasources[0],
            queries: [
              { refId: 'A', key: 'false' },
              { refId: 'B', key: 'true' },
            ],
          },
        },
      },
    } as unknown as Partial<StoreState>);
    jest.spyOn(richHistory, 'addToRichHistory');
    await dispatch(runQueries({ exploreId: 'left' }));
    const calls = (richHistory.addToRichHistory as jest.Mock).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].queries).toHaveLength(1);
    expect(calls[0][0].queries[0].refId).toEqual('B');
  });

  it('with filterQuery not defined, all queries are saved', async () => {
    const { dispatch } = configureStore({
      ...defaultInitialState,
      explore: {
        panes: {
          left: {
            ...defaultInitialState.explore.panes.left,
            datasourceInstance: datasources[1],
            queries: [{ refId: 'A' }, { refId: 'B' }],
          },
        },
      },
    } as unknown as Partial<StoreState>);
    jest.spyOn(richHistory, 'addToRichHistory');
    await dispatch(runQueries({ exploreId: 'left' }));
    const calls = (richHistory.addToRichHistory as jest.Mock).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].queries).toHaveLength(2);
  });
});

describe('running queries', () => {
  it('should cancel running query when cancelQueries is dispatched', async () => {
    const unsubscribable = interval(1000);
    unsubscribable.subscribe();
    const exploreId = 'left';
    const initialState = {
      explore: {
        panes: {
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
  it('should cancel running queries when a new query is issued', async () => {
    const initialState = {
      ...makeExplorePaneState(),
    };
    const dispatchedActions = await thunkTester(initialState)
      .givenThunk(runQueries)
      .whenThunkIsDispatched({ exploreId });

    expect(dispatchedActions).toContainEqual(cancelQueriesAction({ exploreId }));
  });
  it('should not cancel running queries when scanning', async () => {
    const initialState = {
      ...makeExplorePaneState(),
      explore: {
        panes: {
          [exploreId]: {
            scanning: true,
          },
        },
      },
    };
    const dispatchedActions = await thunkTester(initialState)
      .givenThunk(runQueries)
      .whenThunkIsDispatched({ exploreId });

    expect(dispatchedActions).not.toContainEqual(cancelQueriesAction({ exploreId }));
  });
});

describe('changeQueries', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  // Due to how spyOn works (it removes `type`, `match` and `toString` from the spied function, on which we rely on in the reducer),
  // we are repeating the following tests twice, once to chck the resulting state and once to check that the correct actions are dispatched.
  describe('calls the correct actions', () => {
    it('should import queries when datasource is changed', async () => {
      jest.spyOn(actions, 'importQueries');
      jest.spyOn(actions, 'changeQueriesAction');

      const originalQueries = [{ refId: 'A', datasource: datasources[0].getRef() }];

      const { dispatch } = configureStore({
        ...defaultInitialState,
        explore: {
          panes: {
            left: {
              ...defaultInitialState.explore.panes.left,
              datasourceInstance: datasources[0],
              queries: originalQueries,
            },
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(
        changeQueries({
          queries: [{ refId: 'A', datasource: datasources[1].getRef() }],
          exploreId: 'left',
        })
      );

      expect(actions.changeQueriesAction).not.toHaveBeenCalled();
      expect(actions.importQueries).toHaveBeenCalledWith(
        'left',
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
          panes: {
            left: {
              ...defaultInitialState.explore.panes.left,
              datasourceInstance: datasources[0],
              queries: [{ refId: 'A', datasource: datasources[0].getRef() }],
            },
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(
        changeQueries({
          queries: [{ refId: 'A', datasource: datasources[0].getRef(), queryType: 'someValue' }],
          exploreId: 'left',
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
          panes: {
            left: {
              ...defaultInitialState.explore.panes.left,
              datasourceInstance: datasources[0],
              queries: originalQueries,
            },
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(
        changeQueries({
          queries: [{ refId: 'A', datasource: datasources[1].getRef() }],
          exploreId: 'left',
        })
      );

      expect(getState().explore.panes.left!.queries[0]).toHaveProperty('refId', 'A');
      expect(getState().explore.panes.left!.queries[0]).toHaveProperty('datasource', datasources[1].getRef());
    });

    it('should not import queries when datasource is not changed', async () => {
      const { dispatch, getState } = configureStore({
        ...defaultInitialState,
        explore: {
          panes: {
            left: {
              ...defaultInitialState.explore.panes.left,
              datasourceInstance: datasources[0],
              queries: [{ refId: 'A', datasource: datasources[0].getRef() }],
            },
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(
        changeQueries({
          queries: [{ refId: 'A', datasource: datasources[0].getRef(), queryType: 'someValue' }],
          exploreId: 'left',
        })
      );

      expect(getState().explore.panes.left!.queries[0]).toHaveProperty('refId', 'A');
      expect(getState().explore.panes.left!.queries[0]).toHaveProperty('datasource', datasources[0].getRef());
      expect(getState().explore.panes.left!.queries[0]).toEqual({
        refId: 'A',
        datasource: datasources[0].getRef(),
        queryType: 'someValue',
      });
    });
  });

  it('runs remaining queries when one query is removed', async () => {
    jest.spyOn(actions, 'runQueries').mockImplementation(createAsyncThunk('@explore/runQueries', () => {}));

    const originalQueries = [
      { refId: 'A', datasource: datasources[0].getRef() },
      { refId: 'B', datasource: datasources[0].getRef() },
    ];

    const { dispatch } = configureStore({
      ...defaultInitialState,
      explore: {
        panes: {
          left: {
            ...defaultInitialState.explore.panes.left,
            datasourceInstance: datasources[0],
            queries: originalQueries,
          },
        },
      },
    } as unknown as Partial<StoreState>);

    await dispatch(
      changeQueries({
        queries: [originalQueries[0]],
        exploreId: 'left',
      })
    );

    expect(actions.runQueries).toHaveBeenCalled();
  });
});

describe('importing queries', () => {
  describe('when importing queries between the same type of data source', () => {
    it('remove datasource property from all of the queries', async () => {
      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...defaultInitialState,
        explore: {
          panes: {
            left: {
              ...defaultInitialState.explore.panes.left,
              datasourceInstance: datasources[0],
            },
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(
        importQueries(
          'left',
          [
            { datasource: { type: 'postgresql', uid: 'ds1' }, refId: 'refId_A' },
            { datasource: { type: 'postgresql', uid: 'ds1' }, refId: 'refId_B' },
          ],
          datasources[0],
          datasources[1]
        )
      );

      expect(getState().explore.panes.left!.queries[0]).toHaveProperty('refId', 'refId_A');
      expect(getState().explore.panes.left!.queries[1]).toHaveProperty('refId', 'refId_B');
      expect(getState().explore.panes.left!.queries[0]).toHaveProperty('datasource.uid', 'ds2');
      expect(getState().explore.panes.left!.queries[1]).toHaveProperty('datasource.uid', 'ds2');
    });
  });
});

describe('adding new query rows', () => {
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

    expect(getState().explore.panes[exploreId]!.datasourceInstance?.meta?.id).toBe('loki');
    expect(getState().explore.panes[exploreId]!.datasourceInstance?.meta?.mixed).toBe(false);
    expect(getState().explore.panes[exploreId]!.queries).toHaveLength(3);
    expect(getState().explore.panes[exploreId]!.queryKeys).toEqual(['ds3-0', 'ds4-1', 'ds4-2']);
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

    expect(getState().explore.panes[exploreId]!.datasourceInstance?.meta?.id).toBe('mixed');
    expect(getState().explore.panes[exploreId]!.datasourceInstance?.meta?.mixed).toBe(true);
    expect(getState().explore.panes[exploreId]!.queries).toHaveLength(1);
    expect(getState().explore.panes[exploreId]!.queries[0]?.datasource?.type).toBe('postgres');
    expect(getState().explore.panes[exploreId]!.queryKeys).toEqual(['ds1-0']);
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

    expect(getState().explore.panes[exploreId]!.datasourceInstance?.meta?.id).toBe('loki');
    expect(getState().explore.panes[exploreId]!.datasourceInstance?.meta?.mixed).toBe(false);
    expect(getState().explore.panes[exploreId]!.queries).toHaveLength(1);
    expect(getState().explore.panes[exploreId]!.queries[0]?.datasource?.type).toBe('loki');
    expect(getState().explore.panes[exploreId]!.queryKeys).toEqual(['uid-loki-0']);
  });

  it('should add another query row if there are two rows already', async () => {
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
        id: 'mixed',
        mixed: true,
      } as unknown as DataSourcePluginMeta<{}>,
    };

    const getState = await setupStore(queries, datasourceInstance);

    expect(getState().explore.panes[exploreId]!.datasourceInstance?.meta?.id).toBe('mixed');
    expect(getState().explore.panes[exploreId]!.datasourceInstance?.meta?.mixed).toBe(true);
    expect(getState().explore.panes[exploreId]!.queries).toHaveLength(3);
    expect(getState().explore.panes[exploreId]!.queries[2]?.datasource?.type).toBe('loki');
    expect(getState().explore.panes[exploreId]!.queryKeys).toEqual(['ds3-0', 'ds4-1', 'ds4-2']);
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
        .whenActionIsDispatched(scanStartAction({ exploreId: 'left' }))
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
        .whenActionIsDispatched(scanStopAction({ exploreId: 'left' }))
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
            exploreId: 'left',
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
            exploreId: 'left',
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

    describe('addQueryRow', () => {
      it('adds a query from root datasource if root is not mixed and there are no queries', async () => {
        const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
          ...defaultInitialState,
          explore: {
            ...defaultInitialState.explore,
            panes: {
              left: {
                ...defaultInitialState.explore.panes.left,
                queries: [],
                datasourceInstance: {
                  meta: {
                    mixed: false,
                  },
                  getRef() {
                    return { type: 'loki', uid: 'uid-loki' };
                  },
                },
              },
            },
          },
        } as unknown as Partial<StoreState>);

        await dispatch(addQueryRow('left', 0));

        expect(getState().explore.panes.left?.queries).toEqual([
          expect.objectContaining({ datasource: { type: 'loki', uid: 'uid-loki' } }),
        ]);
      });

      it('adds a query from root datasource if root is not mixed and there are queries without a datasource specified', async () => {
        const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
          ...defaultInitialState,
          explore: {
            panes: {
              left: {
                ...defaultInitialState.explore.panes.left,
                queries: [{ expr: 1 }],
                datasourceInstance: {
                  meta: {
                    mixed: false,
                  },
                  getRef() {
                    return { type: 'loki', uid: 'uid-loki' };
                  },
                },
              },
            },
          },
        } as unknown as Partial<StoreState>);

        await dispatch(addQueryRow('left', 0));

        expect(getState().explore.panes.left?.queries).toEqual([
          expect.anything(),
          expect.objectContaining({ datasource: { type: 'loki', uid: 'uid-loki' } }),
        ]);
      });

      it('adds a query from default datasource if root is mixed and there are no queries', async () => {
        const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
          ...defaultInitialState,
          explore: {
            panes: {
              left: {
                ...defaultInitialState.explore.panes.left,
                queries: [],
                datasourceInstance: {
                  meta: {
                    mixed: true,
                  },
                  getRef() {
                    return { type: 'mixed', uid: '-- Mixed --' };
                  },
                },
              },
            },
          },
        } as unknown as Partial<StoreState>);

        await dispatch(addQueryRow('left', 0));

        expect(getState().explore.panes.left?.queries).toEqual([
          expect.objectContaining({ datasource: { type: 'postgres', uid: 'ds1' } }),
        ]);
      });
    });
  });

  describe('caching', () => {
    it('should add response to cache', async () => {
      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...defaultInitialState,
        explore: {
          panes: {
            left: {
              ...defaultInitialState.explore.panes.left,
              queryResponse: {
                series: [{ name: 'test name' }],
                state: LoadingState.Done,
              },
              absoluteRange: { from: 1621348027000, to: 1621348050000 },
            },
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(addResultsToCache('left'));

      expect(getState().explore.panes.left!.cache).toEqual([
        { key: 'from=1621348027000&to=1621348050000', value: { series: [{ name: 'test name' }], state: 'Done' } },
      ]);
    });

    it('should not add response to cache if response is still loading', async () => {
      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...defaultInitialState,
        explore: {
          panes: {
            left: {
              ...defaultInitialState.explore.panes.left,
              queryResponse: { series: [{ name: 'test name' }], state: LoadingState.Loading },
              absoluteRange: { from: 1621348027000, to: 1621348050000 },
            },
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(addResultsToCache('left'));

      expect(getState().explore.panes.left!.cache).toEqual([]);
    });

    it('should not add duplicate response to cache', async () => {
      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...defaultInitialState,
        explore: {
          panes: {
            left: {
              ...defaultInitialState.explore.panes.left,
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
        },
      } as unknown as Partial<StoreState>);

      await dispatch(addResultsToCache('left'));

      expect(getState().explore.panes.left!.cache).toHaveLength(1);
      expect(getState().explore.panes.left!.cache).toEqual([
        { key: 'from=1621348027000&to=1621348050000', value: { series: [{ name: 'old test name' }], state: 'Done' } },
      ]);
    });

    it('should clear cache', async () => {
      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...defaultInitialState,
        explore: {
          panes: {
            left: {
              ...defaultInitialState.explore.panes.left,
              cache: [
                {
                  key: 'from=1621348027000&to=1621348050000',
                  value: { series: [{ name: 'old test name' }], state: 'Done' },
                },
              ],
            },
          },
        },
      } as unknown as Partial<StoreState>);

      await dispatch(clearCache('left'));

      expect(getState().explore.panes.left!.cache).toEqual([]);
    });
  });

  describe('when data source does not support log volume supplementary query', () => {
    it('cleans up query subscription correctly (regression #70049)', async () => {
      const store: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...defaultInitialState,
        explore: {
          panes: {
            left: {
              ...defaultInitialState.explore.panes.left,
              datasourceInstance: {
                getRef: jest.fn(),
                meta: {
                  id: 'something',
                },
                query(
                  request: DataQueryRequest<DataQuery>
                ): Promise<DataQueryResponse> | Observable<DataQueryResponse> {
                  return new Observable(() => cleanUpMock);
                },
              },
            },
          },
        },
      } as unknown as Partial<StoreState>);

      const dispatch = store.dispatch;

      cleanUpMock.mockClear();
      await dispatch(runQueries({ exploreId: 'left' }));
      await dispatch(cancelQueries('left'));
      expect(cleanUpMock).toBeCalledTimes(1);
    });
  });

  describe('legacy supplementary queries', () => {
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
          panes: {
            left: {
              ...defaultInitialState.explore.panes.left,
              datasourceInstance: {
                query: jest.fn(),
                getRef: jest.fn(),
                meta: {
                  id: 'something',
                },
                getDataProvider: (_: SupplementaryQueryType, request: DataQueryRequest<DataQuery>) => {
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
        },
      } as unknown as Partial<StoreState>);

      dispatch = store.dispatch;
      getState = store.getState;

      setupQueryResponse(getState());
    });

    it('should load supplementary queries after running the query', async () => {
      await dispatch(runQueries({ exploreId: 'left' }));
      expect(unsubscribes).toHaveLength(2);
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

      jest.mocked(queryLogsVolume).mockImplementation(() => mockDataProvider());
      jest.mocked(queryLogsSample).mockImplementation(() => mockDataProvider());

      const store: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...defaultInitialState,
        explore: {
          panes: {
            left: {
              ...defaultInitialState.explore.panes.left,
              datasourceInstance: {
                query: jest.fn(),
                getRef: jest.fn(),
                meta: {
                  id: 'something',
                },
                getSupplementaryRequest: (_: SupplementaryQueryType, request: DataQueryRequest<DataQuery>) => {
                  return request;
                },
                getSupportedSupplementaryQueryTypes: () => [
                  SupplementaryQueryType.LogsVolume,
                  SupplementaryQueryType.LogsSample,
                ],
                getSupplementaryQuery: jest.fn(),
              },
            },
          },
        },
      } as unknown as Partial<StoreState>);

      dispatch = store.dispatch;
      getState = store.getState;

      setupQueryResponse(getState());
    });

    it('should cancel any unfinished supplementary queries when a new query is run', async () => {
      await dispatch(runQueries({ exploreId: 'left' }));
      // first query is run automatically
      // loading in progress - subscriptions for both supplementary queries are created, not cleaned up yet
      expect(unsubscribes).toHaveLength(2);
      expect(unsubscribes[0]).not.toBeCalled();
      expect(unsubscribes[1]).not.toBeCalled();

      setupQueryResponse(getState());
      await dispatch(runQueries({ exploreId: 'left' }));
      // a new query is run while supplementary queries are not resolve yet...
      expect(unsubscribes[0]).toBeCalled();
      expect(unsubscribes[1]).toBeCalled();
      // first subscriptions are cleaned up, a new subscriptions are created automatically
      expect(unsubscribes).toHaveLength(4);
      expect(unsubscribes[2]).not.toBeCalled();
      expect(unsubscribes[3]).not.toBeCalled();
    });

    it('should cancel all supported supplementary queries when the main query is canceled', async () => {
      await dispatch(runQueries({ exploreId: 'left' }));
      expect(unsubscribes).toHaveLength(2);
      expect(unsubscribes[0]).not.toBeCalled();
      expect(unsubscribes[1]).not.toBeCalled();

      dispatch(cancelQueries('left'));
      expect(unsubscribes).toHaveLength(2);
      expect(unsubscribes[0]).toBeCalled();
      expect(unsubscribes[1]).toBeCalled();

      for (const type of supplementaryQueryTypes) {
        expect(getState().explore.panes.left!.supplementaryQueries[type].data).toBeUndefined();
        expect(getState().explore.panes.left!.supplementaryQueries[type].dataProvider).toBeUndefined();
      }
    });

    it('should load supplementary queries after running the query', async () => {
      await dispatch(runQueries({ exploreId: 'left' }));
      expect(unsubscribes).toHaveLength(2);
    });

    it('should clean any incomplete supplementary queries data when main query is canceled', async () => {
      mockDataProvider = () => {
        return of({ state: LoadingState.Loading, error: undefined, data: [] });
      };
      await dispatch(runQueries({ exploreId: 'left' }));

      for (const type of supplementaryQueryTypes) {
        expect(getState().explore.panes.left!.supplementaryQueries[type].data).toBeDefined();
        expect(getState().explore.panes.left!.supplementaryQueries[type].data!.state).toBe(LoadingState.Loading);
        expect(getState().explore.panes.left!.supplementaryQueries[type].dataProvider).toBeDefined();
      }
      for (const type of supplementaryQueryTypes) {
        expect(getState().explore.panes.left!.supplementaryQueries[type].data).toBeDefined();
        expect(getState().explore.panes.left!.supplementaryQueries[type].data!.state).toBe(LoadingState.Loading);
        expect(getState().explore.panes.left!.supplementaryQueries[type].dataProvider).toBeDefined();
      }

      dispatch(cancelQueries('left'));
      for (const type of supplementaryQueryTypes) {
        expect(getState().explore.panes.left!.supplementaryQueries[type].data).toBeUndefined();
        expect(getState().explore.panes.left!.supplementaryQueries[type].data).toBeUndefined();
      }
    });

    it('keeps complete supplementary data when main query is canceled', async () => {
      mockDataProvider = () => {
        return of(
          { state: LoadingState.Loading, error: undefined, data: [] },
          { state: LoadingState.Done, error: undefined, data: [{}] }
        );
      };
      await dispatch(runQueries({ exploreId: 'left' }));

      for (const types of supplementaryQueryTypes) {
        expect(getState().explore.panes.left!.supplementaryQueries[types].data).toBeDefined();
        expect(getState().explore.panes.left!.supplementaryQueries[types].data!.state).toBe(LoadingState.Done);
        expect(getState().explore.panes.left!.supplementaryQueries[types].dataProvider).toBeDefined();
      }

      dispatch(cancelQueries('left'));

      for (const types of supplementaryQueryTypes) {
        expect(getState().explore.panes.left!.supplementaryQueries[types].data).toBeDefined();
        expect(getState().explore.panes.left!.supplementaryQueries[types].data!.state).toBe(LoadingState.Done);
        expect(getState().explore.panes.left!.supplementaryQueries[types].dataProvider).toBeUndefined();
      }
    });

    it('do not load disabled supplementary query data', async () => {
      mockDataProvider = () => {
        return of({ state: LoadingState.Done, error: undefined, data: [{}] });
      };
      // turn logs volume off (but keep logs sample on)
      dispatch(setSupplementaryQueryEnabled('left', false, SupplementaryQueryType.LogsVolume));
      expect(getState().explore.panes.left!.supplementaryQueries[SupplementaryQueryType.LogsVolume].enabled).toBe(
        false
      );
      expect(getState().explore.panes.left!.supplementaryQueries[SupplementaryQueryType.LogsSample].enabled).toBe(true);

      // verify that if we run a query, it will: 1) not do logs volume, 2) do logs sample 3) provider will still be set for both
      await dispatch(runQueries({ exploreId: 'left' }));

      expect(
        getState().explore.panes.left!.supplementaryQueries[SupplementaryQueryType.LogsVolume].data
      ).toBeUndefined();
      expect(
        getState().explore.panes.left!.supplementaryQueries[SupplementaryQueryType.LogsVolume].dataSubscription
      ).toBeUndefined();
      expect(
        getState().explore.panes.left!.supplementaryQueries[SupplementaryQueryType.LogsVolume].dataProvider
      ).toBeDefined();

      expect(getState().explore.panes.left!.supplementaryQueries[SupplementaryQueryType.LogsSample].data).toBeDefined();
      expect(
        getState().explore.panes.left!.supplementaryQueries[SupplementaryQueryType.LogsSample].dataSubscription
      ).toBeDefined();
      expect(
        getState().explore.panes.left!.supplementaryQueries[SupplementaryQueryType.LogsSample].dataProvider
      ).toBeDefined();
    });

    it('load data of supplementary query that gets enabled', async () => {
      // first we start with both supplementary queries disabled
      dispatch(setSupplementaryQueryEnabled('left', false, SupplementaryQueryType.LogsVolume));
      dispatch(setSupplementaryQueryEnabled('left', false, SupplementaryQueryType.LogsSample));

      // runQueries sets up providers, but does not run queries
      await dispatch(runQueries({ exploreId: 'left' }));
      expect(
        getState().explore.panes.left!.supplementaryQueries[SupplementaryQueryType.LogsVolume].dataProvider
      ).toBeDefined();
      expect(
        getState().explore.panes.left!.supplementaryQueries[SupplementaryQueryType.LogsSample].dataProvider
      ).toBeDefined();

      // we turn 1 supplementary query (logs volume) on
      dispatch(setSupplementaryQueryEnabled('left', true, SupplementaryQueryType.LogsVolume));

      // verify it was turned on
      expect(getState().explore.panes.left!.supplementaryQueries[SupplementaryQueryType.LogsVolume].enabled).toBe(true);
      // verify that other stay off
      expect(getState().explore.panes.left!.supplementaryQueries[SupplementaryQueryType.LogsSample].enabled).toBe(
        false
      );

      expect(
        getState().explore.panes.left!.supplementaryQueries[SupplementaryQueryType.LogsVolume].dataSubscription
      ).toBeDefined();

      expect(
        getState().explore.panes.left!.supplementaryQueries[SupplementaryQueryType.LogsSample].dataSubscription
      ).toBeUndefined();
    });
  });
  describe('clear live logs', () => {
    it('should clear current log rows', async () => {
      const logRows = makeLogs(10);

      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...defaultInitialState,
        explore: {
          panes: {
            ['left']: {
              ...defaultInitialState.explore.panes['left'],
              queryResponse: {
                state: LoadingState.Streaming,
              },
              logsResult: {
                hasUniqueLabels: false,
                rows: logRows,
              },
            },
          },
        },
      } as unknown as Partial<StoreState>);
      expect(getState().explore.panes['left']?.logsResult?.rows.length).toBe(logRows.length);

      await dispatch(clearLogs({ exploreId: 'left' }));

      expect(getState().explore.panes['left']?.logsResult?.rows.length).toBe(0);
      expect(getState().explore.panes['left']?.clearedAtIndex).toBe(logRows.length - 1);
    });

    it('should filter new log rows', async () => {
      const oldLogRows = makeLogs(10);
      const newLogRows = makeLogs(5);
      const allLogRows = [...oldLogRows, ...newLogRows];

      const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
        ...defaultInitialState,
        explore: {
          panes: {
            ['left']: {
              ...defaultInitialState.explore.panes['left'],
              isLive: true,
              queryResponse: {
                state: LoadingState.Streaming,
              },
              logsResult: {
                hasUniqueLabels: false,
                rows: oldLogRows,
              },
            },
          },
        },
      } as unknown as Partial<StoreState>);

      expect(getState().explore.panes['left']?.logsResult?.rows.length).toBe(oldLogRows.length);

      await dispatch(clearLogs({ exploreId: 'left' }));
      await dispatch(
        queryStreamUpdatedAction({
          exploreId: 'left',
          response: {
            request: true,
            traceFrames: [],
            nodeGraphFrames: [],
            rawPrometheusFrames: [],
            flameGraphFrames: [],
            logsResult: {
              hasUniqueLabels: false,
              rows: allLogRows,
            },
          },
        } as unknown as QueryEndedPayload)
      );

      expect(getState().explore.panes['left']?.logsResult?.rows.length).toBe(newLogRows.length);
      expect(getState().explore.panes['left']?.clearedAtIndex).toBe(oldLogRows.length - 1);
    });
  });
});
