import { paneReducer, setAddingSavedQueryAction } from './explorePane';
import { makeExplorePaneState } from './utils';

describe('explorePane reducer', () => {
  describe('setAddingSavedQueryAction', () => {
    it('sets addingSavedQuery to true', () => {
      const initialState = makeExplorePaneState();
      expect(initialState.addingSavedQuery).toBeUndefined();

      const nextState = paneReducer(
        initialState,
        setAddingSavedQueryAction({ exploreId: 'left', addingSavedQuery: true })
      );

      expect(nextState.addingSavedQuery).toBe(true);
    });

    it('clears addingSavedQuery when set to false', () => {
      const initialState = makeExplorePaneState({ addingSavedQuery: true });

      const nextState = paneReducer(
        initialState,
        setAddingSavedQueryAction({ exploreId: 'left', addingSavedQuery: false })
      );

      expect(nextState.addingSavedQuery).toBe(false);
    });
  });
});
