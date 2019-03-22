import { itemReducer, makeExploreItemState, exploreReducer, initialExploreState } from './reducers';
import { ExploreId, ExploreItemState, ExploreState } from 'app/types/explore';
import { reducerTester } from 'test/core/redux/reducerTester';
import { scanStartAction, scanStopAction, splitOpenAction, splitCloseAction } from './actionTypes';
import { Reducer } from 'redux';
import { ActionOf } from 'app/core/redux/actionCreatorFactory';

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
