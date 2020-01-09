import { DataQuery, DataSourceApi, dateTime, LoadingState, LogsDedupStrategy, toDataFrame } from '@grafana/data';

import {
  createEmptyQueryResponse,
  exploreReducer,
  initialExploreState,
  itemReducer,
  makeExploreItemState,
  makeInitialUpdateState,
} from './reducers';
import { ExploreId, ExploreItemState, ExploreMode, ExploreState, ExploreUrlState } from 'app/types/explore';
import { reducerTester } from 'test/core/redux/reducerTester';
import {
  changeModeAction,
  changeRangeAction,
  changeRefreshIntervalAction,
  scanStartAction,
  scanStopAction,
  splitCloseAction,
  splitOpenAction,
  toggleGraphAction,
  toggleTableAction,
  updateDatasourceInstanceAction,
} from './actionTypes';
import { serializeStateToUrlParam } from 'app/core/utils/explore';
import { updateLocation } from '../../../core/actions';

describe('Explore item reducer', () => {
  describe('scanning', () => {
    it('should start scanning', () => {
      const initialState = {
        ...makeExploreItemState(),
        scanning: false,
      };

      reducerTester()
        .givenReducer(itemReducer, initialState)
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
        .givenReducer(itemReducer, initialState)
        .whenActionIsDispatched(scanStopAction({ exploreId: ExploreId.left }))
        .thenStateShouldEqual({
          ...makeExploreItemState(),
          scanning: false,
          scanRange: undefined,
        });
    });
  });

  describe('changing datasource', () => {
    describe('when changeMode is dispatched', () => {
      it('then it should set correct state', () => {
        reducerTester()
          .givenReducer(itemReducer, {})
          .whenActionIsDispatched(changeModeAction({ exploreId: ExploreId.left, mode: ExploreMode.Logs }))
          .thenStatePredicateShouldEqual((resultingState: ExploreItemState) => {
            expect(resultingState.mode).toEqual(ExploreMode.Logs);
            expect(resultingState.logsResult).toBeNull();
            expect(resultingState.graphResult).toBeNull();
            expect(resultingState.tableResult).toBeNull();
            return true;
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
          const initialState: Partial<ExploreItemState> = {
            datasourceInstance: null,
            queries,
            queryKeys,
          };
          const expectedState: any = {
            datasourceInstance,
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
            .givenReducer(itemReducer, initialState)
            .whenActionIsDispatched(updateDatasourceInstanceAction({ exploreId: ExploreId.left, datasourceInstance }))
            .thenStateShouldEqual(expectedState);
        });
      });
    });
  });

  describe('changing refresh intervals', () => {
    it("should result in 'streaming' state, when live-tailing is active", () => {
      const initialState = makeExploreItemState();
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
        .givenReducer(itemReducer, initialState)
        .whenActionIsDispatched(changeRefreshIntervalAction({ exploreId: ExploreId.left, refreshInterval: 'LIVE' }))
        .thenStateShouldEqual(expectedState);
    });

    it("should result in 'done' state, when live-tailing is stopped", () => {
      const initialState = makeExploreItemState();
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
        .givenReducer(itemReducer, initialState)
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
        const table = toDataFrame({
          name: 'logs',
          fields: [
            {
              name: 'time',
              type: 'number',
              values: [1, 2],
            },
          ],
        });

        reducerTester()
          .givenReducer(itemReducer, { tableResult: table })
          .whenActionIsDispatched(toggleTableAction({ exploreId: ExploreId.left }))
          .thenStateShouldEqual({ showingTable: true, tableResult: table })
          .whenActionIsDispatched(toggleTableAction({ exploreId: ExploreId.left }))
          .thenStateShouldEqual({ showingTable: false, tableResult: null });
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
        .givenReducer(exploreReducer, initialState)
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
          .givenReducer(exploreReducer, initialState)
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
          .givenReducer(exploreReducer, initialState)
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
