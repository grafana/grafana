import { itemReducer, makeExploreItemState } from './reducers';
import { ExploreId, ExploreItemState } from 'app/types/explore';
import { reducerTester } from 'test/core/redux/reducerTester';
import { scanStartAction, scanStopAction } from './actionTypes';
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
