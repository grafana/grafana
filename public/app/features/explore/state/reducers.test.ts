import { Action, ActionTypes } from './actionTypes';
import { itemReducer, makeExploreItemState } from './reducers';
import { ExploreId } from 'app/types/explore';

describe('Explore item reducer', () => {
  describe('scanning', () => {
    test('should start scanning', () => {
      let state = makeExploreItemState();
      const action: Action = {
        type: ActionTypes.ScanStart,
        payload: {
          exploreId: ExploreId.left,
          scanner: jest.fn(),
        },
      };
      state = itemReducer(state, action);
      expect(state.scanning).toBeTruthy();
      expect(state.scanner).toBe(action.payload.scanner);
    });
    test('should stop scanning', () => {
      let state = makeExploreItemState();
      const start: Action = {
        type: ActionTypes.ScanStart,
        payload: {
          exploreId: ExploreId.left,
          scanner: jest.fn(),
        },
      };
      state = itemReducer(state, start);
      expect(state.scanning).toBeTruthy();
      const action: Action = {
        type: ActionTypes.ScanStop,
        payload: {
          exploreId: ExploreId.left,
        },
      };
      state = itemReducer(state, action);
      expect(state.scanning).toBeFalsy();
      expect(state.scanner).toBeUndefined();
    });
  });
});
