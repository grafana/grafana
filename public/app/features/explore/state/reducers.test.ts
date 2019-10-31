import {
  itemReducer,
  makeExploreItemState,
  exploreReducer,
  makeInitialUpdateState,
  initialExploreState,
  createEmptyQueryResponse,
} from './reducers';
import { ExploreId, ExploreItemState, ExploreUrlState, ExploreState, ExploreMode } from 'app/types/explore';
import { reducerTester } from 'test/core/redux/reducerTester';
import {
  scanStartAction,
  updateDatasourceInstanceAction,
  splitOpenAction,
  splitCloseAction,
  changeModeAction,
  scanStopAction,
  toggleGraphAction,
  toggleTableAction,
  changeRangeAction,
  changeRefreshIntervalAction,
} from './actionTypes';
import { Reducer } from 'redux';
import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { updateLocation } from 'app/core/actions/location';
import { serializeStateToUrlParam } from 'app/core/utils/explore';
import TableModel from 'app/core/table_model';
import { DataSourceApi, DataQuery, LogsDedupStrategy, dateTime, LoadingState } from '@grafana/data';

describe('Explore item reducer', () => {
  describe('scanning', () => {
    it('should start scanning', () => {
      const initalState = {
        ...makeExploreItemState(),
        scanning: false,
      };

      reducerTester()
        .givenReducer(itemReducer as Reducer<ExploreItemState, ActionOf<any>>, initalState)
        .whenActionIsDispatched(scanStartAction({ exploreId: ExploreId.left }))
        .thenStateShouldEqual({
          ...makeExploreItemState(),
          scanning: true,
        });
    });
    it('should stop scanning', () => {
      const initalState = {
        ...makeExploreItemState(),
        scanning: true,
        scanRange: {},
      };

      reducerTester()
        .givenReducer(itemReducer as Reducer<ExploreItemState, ActionOf<any>>, initalState)
        .whenActionIsDispatched(scanStopAction({ exploreId: ExploreId.left }))
        .thenStateShouldEqual({
          ...makeExploreItemState(),
          scanning: false,
          scanRange: undefined,
        });
    });
  });

  describe('changing datasource', () => {
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
          const initalState: Partial<ExploreItemState> = {
            datasourceInstance: null,
            StartPage: null,
            showingStartPage: false,
            queries,
            queryKeys,
          };
          const expectedState: any = {
            datasourceInstance,
            StartPage,
            showingStartPage: true,
            queries,
            queryKeys,
            graphResult: null,
            logsResult: null,
            tableResult: null,
            supportedModes: [ExploreMode.Metrics, ExploreMode.Logs],
            mode: ExploreMode.Metrics,
            latency: 0,
            loading: false,
            queryResponse: createEmptyQueryResponse(),
          };

          reducerTester()
            .givenReducer(itemReducer, initalState)
            .whenActionIsDispatched(updateDatasourceInstanceAction({ exploreId: ExploreId.left, datasourceInstance }))
            .thenStateShouldEqual(expectedState);
        });
      });
    });
  });

  describe('changing refresh intervals', () => {
    it("should result in 'streaming' state, when live-tailing is active", () => {
      const initalState = makeExploreItemState();
      const expectedState = {
        ...makeExploreItemState(),
        refreshInterval: 'LIVE',
        isLive: true,
        loading: true,
        logsResult: {
          hasUniqueLabels: false,
          rows: [] as any[],
        },
        queryResponse: {
          ...makeExploreItemState().queryResponse,
          state: LoadingState.Streaming,
        },
      };
      reducerTester()
        .givenReducer(itemReducer, initalState)
        .whenActionIsDispatched(changeRefreshIntervalAction({ exploreId: ExploreId.left, refreshInterval: 'LIVE' }))
        .thenStateShouldEqual(expectedState);
    });

    it("should result in 'done' state, when live-tailing is stopped", () => {
      const initalState = makeExploreItemState();
      const expectedState = {
        ...makeExploreItemState(),
        refreshInterval: '',
        logsResult: {
          hasUniqueLabels: false,
          rows: [] as any[],
        },
        queryResponse: {
          ...makeExploreItemState().queryResponse,
          state: LoadingState.Done,
        },
      };
      reducerTester()
        .givenReducer(itemReducer, initalState)
        .whenActionIsDispatched(changeRefreshIntervalAction({ exploreId: ExploreId.left, refreshInterval: '' }))
        .thenStateShouldEqual(expectedState);
    });
  });

  describe('toggling panels', () => {
    describe('when toggleGraphAction is dispatched', () => {
      it('then it should set correct state', () => {
        reducerTester()
          .givenReducer(itemReducer, { graphResult: [] })
          .whenActionIsDispatched(toggleGraphAction({ exploreId: ExploreId.left }))
          .thenStateShouldEqual({ showingGraph: true, graphResult: [] })
          .whenActionIsDispatched(toggleGraphAction({ exploreId: ExploreId.left }))
          .thenStateShouldEqual({ showingGraph: false, graphResult: null });
      });
    });

    describe('when toggleTableAction is dispatched', () => {
      it('then it should set correct state', () => {
        reducerTester()
          .givenReducer(itemReducer, { tableResult: {} })
          .whenActionIsDispatched(toggleTableAction({ exploreId: ExploreId.left }))
          .thenStateShouldEqual({ showingTable: true, tableResult: {} })
          .whenActionIsDispatched(toggleTableAction({ exploreId: ExploreId.left }))
          .thenStateShouldEqual({ showingTable: false, tableResult: new TableModel() });
      });
    });
  });

  describe('changing range', () => {
    describe('when changeRangeAction is dispatched', () => {
      it('then it should set correct state', () => {
        reducerTester()
          .givenReducer(itemReducer, {
            update: { ...makeInitialUpdateState(), range: true },
            range: null,
            absoluteRange: null,
          })
          .whenActionIsDispatched(
            changeRangeAction({
              exploreId: ExploreId.left,
              absoluteRange: { from: 1546297200000, to: 1546383600000 },
              range: { from: dateTime('2019-01-01'), to: dateTime('2019-01-02'), raw: { from: 'now-1d', to: 'now' } },
            })
          )
          .thenStateShouldEqual({
            update: { ...makeInitialUpdateState(), range: false },
            absoluteRange: { from: 1546297200000, to: 1546383600000 },
            range: { from: dateTime('2019-01-01'), to: dateTime('2019-01-02'), raw: { from: 'now-1d', to: 'now' } },
          });
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
  const initalState = { split: false, left: { urlState, update }, right: { urlState, update } };

  return {
    initalState,
    serializedUrlState,
  };
};

describe('Explore reducer', () => {
  describe('split view', () => {
    it("should make right pane a duplicate of the given item's state on split open", () => {
      const leftItemMock = {
        containerWidth: 100,
      } as ExploreItemState;

      const initalState = {
        split: null,
        left: leftItemMock as ExploreItemState,
        right: makeExploreItemState(),
      } as ExploreState;

      reducerTester()
        .givenReducer(exploreReducer as Reducer<ExploreState, ActionOf<any>>, initalState)
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

        const initalState = {
          split: null,
          left: leftItemMock,
          right: rightItemMock,
        } as ExploreState;

        // closing left item
        reducerTester()
          .givenReducer(exploreReducer as Reducer<ExploreState, ActionOf<any>>, initalState)
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

        const initalState = {
          split: null,
          left: leftItemMock,
          right: rightItemMock,
        } as ExploreState;

        // closing left item
        reducerTester()
          .givenReducer(exploreReducer as Reducer<ExploreState, ActionOf<any>>, initalState)
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
          const { initalState, serializedUrlState } = setup();
          const expectedState = { ...initalState, split: true };

          reducerTester()
            .givenReducer(exploreReducer, initalState)
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
            const { initalState, serializedUrlState } = setup();
            const urlState: ExploreUrlState = null;
            const stateWithoutUrlState = { ...initalState, left: { urlState } };
            const expectedState = { ...initalState };

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
            const { initalState, serializedUrlState } = setup();
            const expectedState = { ...initalState };

            reducerTester()
              .givenReducer(exploreReducer, initalState)
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
              const { initalState, serializedUrlState } = setup();
              const expectedState = {
                ...initalState,
                left: {
                  ...initalState.left,
                  update: {
                    ...initalState.left.update,
                    datasource: true,
                  },
                },
              };
              const stateWithDifferentDataSource = {
                ...initalState,
                left: {
                  ...initalState.left,
                  urlState: {
                    ...initalState.left.urlState,
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
              const { initalState, serializedUrlState } = setup();
              const expectedState = {
                ...initalState,
                left: {
                  ...initalState.left,
                  update: {
                    ...initalState.left.update,
                    range: true,
                  },
                },
              };
              const stateWithDifferentDataSource = {
                ...initalState,
                left: {
                  ...initalState.left,
                  urlState: {
                    ...initalState.left.urlState,
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
              const { initalState, serializedUrlState } = setup();
              const expectedState = {
                ...initalState,
                left: {
                  ...initalState.left,
                  update: {
                    ...initalState.left.update,
                    queries: true,
                  },
                },
              };
              const stateWithDifferentDataSource = {
                ...initalState,
                left: {
                  ...initalState.left,
                  urlState: {
                    ...initalState.left.urlState,
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
              const { initalState, serializedUrlState } = setup();
              const expectedState = {
                ...initalState,
                left: {
                  ...initalState.left,
                  update: {
                    ...initalState.left.update,
                    ui: true,
                  },
                },
              };
              const stateWithDifferentDataSource = {
                ...initalState,
                left: {
                  ...initalState.left,
                  urlState: {
                    ...initalState.left.urlState,
                    ui: {
                      ...initalState.left.urlState.ui,
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
              const { initalState, serializedUrlState } = setup();
              const expectedState = { ...initalState };

              reducerTester()
                .givenReducer(exploreReducer, initalState)
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
