import { AnyAction } from 'redux';
import { createAction } from '@reduxjs/toolkit';

import { reducerTester } from './reducerTester';

interface DummyState {
  data: string[];
}

const initialState: DummyState = {
  data: [],
};

const dummyAction = createAction<string>('dummyAction');

const mutatingReducer = (state: DummyState = initialState, action: AnyAction): DummyState => {
  if (dummyAction.match(action)) {
    state.data.push(action.payload);
    return state;
  }

  return state;
};

const okReducer = (state: DummyState = initialState, action: AnyAction): DummyState => {
  if (dummyAction.match(action)) {
    return {
      ...state,
      data: state.data.concat(action.payload),
    };
  }

  return state;
};

describe('reducerTester', () => {
  describe('when reducer mutates state', () => {
    it('then it should throw', () => {
      expect(() => {
        reducerTester<DummyState>()
          .givenReducer(mutatingReducer, initialState)
          .whenActionIsDispatched(dummyAction('some string'));
      }).toThrow();
    });
  });

  describe('when reducer does not mutate state', () => {
    it('then it should not throw', () => {
      expect(() => {
        reducerTester<DummyState>()
          .givenReducer(okReducer, initialState)
          .whenActionIsDispatched(dummyAction('some string'));
      }).not.toThrow();
    });
  });
});
