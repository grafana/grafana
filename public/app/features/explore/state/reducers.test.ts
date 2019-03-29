import {
  itemReducer,
  makeExploreItemState,
  exploreReducer,
  makeInitialUpdateState,
  initialExploreState,
} from './reducers';
import { ExploreId, ExploreItemState, ExploreUrlState, ExploreState } from 'app/types/explore';
import { reducerTester } from 'test/core/redux/reducerTester';
import { scanStartAction, scanStopAction, splitOpenAction, splitCloseAction } from './actionTypes';
import { Reducer } from 'redux';
import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { updateLocation } from 'app/core/actions/location';
import { LogsDedupStrategy } from 'app/core/logs_model';
import { serializeStateToUrlParam } from 'app/core/utils/explore';

describe('Explore item reducer', () => {
  describe('scanning', () => {
    test('should start scanning', () => {
      const scanner = jest.fn();
      const initalState = {
        ...makeExploreItemState(),
        scanning: false,
        scanner: undefined,
      };

      reducerTester()
        .givenReducer(itemReducer as Reducer<ExploreItemState, ActionOf<any>>, initalState)
        .whenActionIsDispatched(scanStartAction({ exploreId: ExploreId.left, scanner }))
        .thenStateShouldEqual({
          ...makeExploreItemState(),
          scanning: true,
          scanner,
        });
    });
    test('should stop scanning', () => {
      const scanner = jest.fn();
      const initalState = {
        ...makeExploreItemState(),
        scanning: true,
        scanner,
        scanRange: {},
      };

      reducerTester()
        .givenReducer(itemReducer as Reducer<ExploreItemState, ActionOf<any>>, initalState)
        .whenActionIsDispatched(scanStopAction({ exploreId: ExploreId.left }))
        .thenStateShouldEqual({
          ...makeExploreItemState(),
          scanning: false,
          scanner: undefined,
          scanRange: undefined,
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
            const stateWithoutUrlState = { ...initalState, left: { urlState: null } };
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
            fit('then it should return update ui', () => {
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
