import {
  itemReducer,
  makeExploreItemState,
  exploreReducer,
  makeInitialUpdateState,
  initialExploreState,
} from './reducers';
import { ExploreId, ExploreItemState, ExploreUrlState, ExploreState, ExploreMode } from 'app/types/explore';
import { reducerTester } from 'test/core/redux/reducerTester';
import {
  scanStartAction,
  testDataSourcePendingAction,
  testDataSourceSuccessAction,
  testDataSourceFailureAction,
  updateDatasourceInstanceAction,
  splitOpenAction,
  splitCloseAction,
  changeModeAction,
  scanStopAction,
  runQueriesAction,
} from './actionTypes';
import { Reducer } from 'redux';
import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { updateLocation } from 'app/core/actions/location';
import { serializeStateToUrlParam } from 'app/core/utils/explore';
import TableModel from 'app/core/table_model';
import { DataSourceApi, DataQuery, LogsModel, LogsDedupStrategy, LoadingState } from '@grafana/ui';

describe('Explore item reducer', () => {
  describe('scanning', () => {
    it('should start scanning', () => {
      const initialState = {
        ...makeExploreItemState(),
        scanning: false,
      };

      reducerTester()
        .givenReducer(itemReducer as Reducer<ExploreItemState, ActionOf<any>>, initialState)
        .whenActionIsDispatched(scanStartAction({ exploreId: ExploreId.left }))
        .thenStateShouldEqual({
          ...makeExploreItemState(),
          scanning: true,
        });
    });
    it('should stop scanning', () => {
      const initialState = {
        ...makeExploreItemState(),
        scanning: true,
        scanRange: {},
      };

      reducerTester()
        .givenReducer(itemReducer as Reducer<ExploreItemState, ActionOf<any>>, initialState)
        .whenActionIsDispatched(scanStopAction({ exploreId: ExploreId.left }))
        .thenStateShouldEqual({
          ...makeExploreItemState(),
          scanning: false,
          scanRange: undefined,
        });
    });
  });

  describe('testing datasource', () => {
    describe('when testDataSourcePendingAction is dispatched', () => {
      it('then it should set datasourceError', () => {
        reducerTester()
          .givenReducer(itemReducer, { datasourceError: {} })
          .whenActionIsDispatched(testDataSourcePendingAction({ exploreId: ExploreId.left }))
          .thenStateShouldEqual({ datasourceError: null });
      });
    });

    describe('when testDataSourceSuccessAction is dispatched', () => {
      it('then it should set datasourceError', () => {
        reducerTester()
          .givenReducer(itemReducer, { datasourceError: {} })
          .whenActionIsDispatched(testDataSourceSuccessAction({ exploreId: ExploreId.left }))
          .thenStateShouldEqual({ datasourceError: null });
      });
    });

    describe('when testDataSourceFailureAction is dispatched', () => {
      it('then it should set correct state', () => {
        const error = 'some error';
        const initialState: Partial<ExploreItemState> = {
          datasourceError: null,
          graphResult: [],
          tableResult: {} as TableModel,
          logsResult: {} as LogsModel,
          update: {
            datasource: true,
            queries: true,
            range: true,
            mode: true,
            ui: true,
          },
        };
        const expectedState = {
          datasourceError: error,
          graphResult: undefined as any[],
          tableResult: undefined as TableModel,
          logsResult: undefined as LogsModel,
          update: makeInitialUpdateState(),
        };

        reducerTester()
          .givenReducer(itemReducer, initialState)
          .whenActionIsDispatched(testDataSourceFailureAction({ exploreId: ExploreId.left, error }))
          .thenStateShouldEqual(expectedState);
      });
    });

    describe('when changeDataType is dispatched', () => {
      it('then it should set correct state', () => {
        reducerTester()
          .givenReducer(itemReducer, {})
          .whenActionIsDispatched(changeModeAction({ exploreId: ExploreId.left, mode: ExploreMode.Logs }))
          .thenStateShouldEqual({
            mode: ExploreMode.Logs,
          });
      });
    });
  });

  describe('changing datasource', () => {
    describe('when updateDatasourceInstanceAction is dispatched', () => {
      describe('and datasourceInstance supports graph, logs, table and has a startpage', () => {
        it('then it should set correct state', () => {
          const StartPage = {};
          const datasourceInstance = {
            meta: {
              metrics: true,
              logs: true,
            },
            components: {
              ExploreStartPage: StartPage,
            },
          } as DataSourceApi;
          const queries: DataQuery[] = [];
          const queryKeys: string[] = [];
          const initialState: Partial<ExploreItemState> = {
            datasourceInstance: null,
            StartPage: null,
            showingStartPage: false,
            queries,
            queryKeys,
          };
          const expectedState = {
            datasourceInstance,
            StartPage,
            showingStartPage: true,
            queries,
            queryKeys,
            supportedModes: [ExploreMode.Metrics, ExploreMode.Logs],
            modesSupportingTextEdit: [],
            mode: ExploreMode.Metrics,
            loadingState: LoadingState.NotStarted,
            latency: 0,
            queryErrors: [],
          };

          reducerTester()
            .givenReducer(itemReducer, initialState)
            .whenActionIsDispatched(updateDatasourceInstanceAction({ exploreId: ExploreId.left, datasourceInstance }))
            .thenStateShouldEqual(expectedState);
        });
      });
    });
  });

  describe('run queries', () => {
    describe('when runQueriesAction is dispatched', () => {
      it('then it should set correct state', () => {
        const initialState: Partial<ExploreItemState> = {
          showingStartPage: true,
          range: null,
        };
        const expectedState = {
          queryIntervals: {
            interval: '1s',
            intervalMs: 1000,
          },
          showingStartPage: false,
          range: null,
        };

        reducerTester()
          .givenReducer(itemReducer, initialState)
          .whenActionIsDispatched(runQueriesAction({ exploreId: ExploreId.left }))
          .thenStateShouldEqual(expectedState);
      });
    });
  });
});

export const setup = (urlStateOverrides?: any) => {
  const update = makeInitialUpdateState();
  const urlStateDefaults: ExploreUrlState = {
    datasource: 'some-datasource',
    queries: [],
    range: {
      from: '',
      to: '',
    },
    mode: ExploreMode.Metrics,
    ui: {
      dedupStrategy: LogsDedupStrategy.none,
      showingGraph: false,
      showingTable: false,
      showingLogs: false,
    },
  };
  const urlState: ExploreUrlState = { ...urlStateDefaults, ...urlStateOverrides };
  const serializedUrlState = serializeStateToUrlParam(urlState);
  const initialState = { split: false, left: { urlState, update }, right: { urlState, update } };

  return {
    initialState,
    serializedUrlState,
  };
};

describe('Explore reducer', () => {
  describe('split view', () => {
    it("should make right pane a duplicate of the given item's state on split open", () => {
      const leftItemMock = {
        containerWidth: 100,
      } as ExploreItemState;

      const initialState = {
        split: null,
        left: leftItemMock as ExploreItemState,
        right: makeExploreItemState(),
      } as ExploreState;

      reducerTester()
        .givenReducer(exploreReducer as Reducer<ExploreState, ActionOf<any>>, initialState)
        .whenActionIsDispatched(splitOpenAction({ itemState: leftItemMock }))
        .thenStateShouldEqual({
          split: true,
          left: leftItemMock,
          right: leftItemMock,
        });
    });

    describe('split close', () => {
      it('should keep right pane as left when left is closed', () => {
        const leftItemMock = {
          containerWidth: 100,
        } as ExploreItemState;

        const rightItemMock = {
          containerWidth: 200,
        } as ExploreItemState;

        const initialState = {
          split: null,
          left: leftItemMock,
          right: rightItemMock,
        } as ExploreState;

        // closing left item
        reducerTester()
          .givenReducer(exploreReducer as Reducer<ExploreState, ActionOf<any>>, initialState)
          .whenActionIsDispatched(splitCloseAction({ itemId: ExploreId.left }))
          .thenStateShouldEqual({
            split: false,
            left: rightItemMock,
            right: initialExploreState.right,
          });
      });
      it('should reset right pane when it is closed ', () => {
        const leftItemMock = {
          containerWidth: 100,
        } as ExploreItemState;

        const rightItemMock = {
          containerWidth: 200,
        } as ExploreItemState;

        const initialState = {
          split: null,
          left: leftItemMock,
          right: rightItemMock,
        } as ExploreState;

        // closing left item
        reducerTester()
          .givenReducer(exploreReducer as Reducer<ExploreState, ActionOf<any>>, initialState)
          .whenActionIsDispatched(splitCloseAction({ itemId: ExploreId.right }))
          .thenStateShouldEqual({
            split: false,
            left: leftItemMock,
            right: initialExploreState.right,
          });
      });
    });
  });

  describe('when updateLocation is dispatched', () => {
    describe('and payload does not contain a query', () => {
      it('then it should just return state', () => {
        reducerTester()
          .givenReducer(exploreReducer, {})
          .whenActionIsDispatched(updateLocation({ query: null }))
          .thenStateShouldEqual({});
      });
    });

    describe('and payload contains a query', () => {
      describe("but does not contain 'left'", () => {
        it('then it should just return state', () => {
          reducerTester()
            .givenReducer(exploreReducer, {})
            .whenActionIsDispatched(updateLocation({ query: {} }))
            .thenStateShouldEqual({});
        });
      });

      describe("and query contains a 'right'", () => {
        it('then it should add split in state', () => {
          const { initialState, serializedUrlState } = setup();
          const expectedState = { ...initialState, split: true };

          reducerTester()
            .givenReducer(exploreReducer, initialState)
            .whenActionIsDispatched(
              updateLocation({
                query: {
                  left: serializedUrlState,
                  right: serializedUrlState,
                },
              })
            )
            .thenStateShouldEqual(expectedState);
        });
      });

      describe("and query contains a 'left'", () => {
        describe('but urlState is not set in state', () => {
          it('then it should just add urlState and update in state', () => {
            const { initialState, serializedUrlState } = setup();
            const urlState: ExploreUrlState = null;
            const stateWithoutUrlState = { ...initialState, left: { urlState } };
            const expectedState = { ...initialState };

            reducerTester()
              .givenReducer(exploreReducer, stateWithoutUrlState)
              .whenActionIsDispatched(
                updateLocation({
                  query: {
                    left: serializedUrlState,
                  },
                  path: '/explore',
                })
              )
              .thenStateShouldEqual(expectedState);
          });
        });

        describe("but '/explore' is missing in path", () => {
          it('then it should just add urlState and update in state', () => {
            const { initialState, serializedUrlState } = setup();
            const expectedState = { ...initialState };

            reducerTester()
              .givenReducer(exploreReducer, initialState)
              .whenActionIsDispatched(
                updateLocation({
                  query: {
                    left: serializedUrlState,
                  },
                  path: '/dashboard',
                })
              )
              .thenStateShouldEqual(expectedState);
          });
        });

        describe("and '/explore' is in path", () => {
          describe('and datasource differs', () => {
            it('then it should return update datasource', () => {
              const { initialState, serializedUrlState } = setup();
              const expectedState = {
                ...initialState,
                left: {
                  ...initialState.left,
                  update: {
                    ...initialState.left.update,
                    datasource: true,
                  },
                },
              };
              const stateWithDifferentDataSource = {
                ...initialState,
                left: {
                  ...initialState.left,
                  urlState: {
                    ...initialState.left.urlState,
                    datasource: 'different datasource',
                  },
                },
              };

              reducerTester()
                .givenReducer(exploreReducer, stateWithDifferentDataSource)
                .whenActionIsDispatched(
                  updateLocation({
                    query: {
                      left: serializedUrlState,
                    },
                    path: '/explore',
                  })
                )
                .thenStateShouldEqual(expectedState);
            });
          });

          describe('and range differs', () => {
            it('then it should return update range', () => {
              const { initialState, serializedUrlState } = setup();
              const expectedState = {
                ...initialState,
                left: {
                  ...initialState.left,
                  update: {
                    ...initialState.left.update,
                    range: true,
                  },
                },
              };
              const stateWithDifferentDataSource = {
                ...initialState,
                left: {
                  ...initialState.left,
                  urlState: {
                    ...initialState.left.urlState,
                    range: {
                      from: 'now',
                      to: 'now-6h',
                    },
                  },
                },
              };

              reducerTester()
                .givenReducer(exploreReducer, stateWithDifferentDataSource)
                .whenActionIsDispatched(
                  updateLocation({
                    query: {
                      left: serializedUrlState,
                    },
                    path: '/explore',
                  })
                )
                .thenStateShouldEqual(expectedState);
            });
          });

          describe('and queries differs', () => {
            it('then it should return update queries', () => {
              const { initialState, serializedUrlState } = setup();
              const expectedState = {
                ...initialState,
                left: {
                  ...initialState.left,
                  update: {
                    ...initialState.left.update,
                    queries: true,
                  },
                },
              };
              const stateWithDifferentDataSource = {
                ...initialState,
                left: {
                  ...initialState.left,
                  urlState: {
                    ...initialState.left.urlState,
                    queries: [{ expr: '{__filename__="some.log"}' }],
                  },
                },
              };

              reducerTester()
                .givenReducer(exploreReducer, stateWithDifferentDataSource)
                .whenActionIsDispatched(
                  updateLocation({
                    query: {
                      left: serializedUrlState,
                    },
                    path: '/explore',
                  })
                )
                .thenStateShouldEqual(expectedState);
            });
          });

          describe('and ui differs', () => {
            it('then it should return update ui', () => {
              const { initialState, serializedUrlState } = setup();
              const expectedState = {
                ...initialState,
                left: {
                  ...initialState.left,
                  update: {
                    ...initialState.left.update,
                    ui: true,
                  },
                },
              };
              const stateWithDifferentDataSource = {
                ...initialState,
                left: {
                  ...initialState.left,
                  urlState: {
                    ...initialState.left.urlState,
                    ui: {
                      ...initialState.left.urlState.ui,
                      showingGraph: true,
                    },
                  },
                },
              };

              reducerTester()
                .givenReducer(exploreReducer, stateWithDifferentDataSource)
                .whenActionIsDispatched(
                  updateLocation({
                    query: {
                      left: serializedUrlState,
                    },
                    path: '/explore',
                  })
                )
                .thenStateShouldEqual(expectedState);
            });
          });

          describe('and nothing differs', () => {
            it('then it should return update ui', () => {
              const { initialState, serializedUrlState } = setup();
              const expectedState = { ...initialState };

              reducerTester()
                .givenReducer(exploreReducer, initialState)
                .whenActionIsDispatched(
                  updateLocation({
                    query: {
                      left: serializedUrlState,
                    },
                    path: '/explore',
                  })
                )
                .thenStateShouldEqual(expectedState);
            });
          });
        });
      });
    });
  });
});
