import { reducerFactory, actionCreatorFactory } from 'app/core/redux';
import { reducerTester } from './reducerTester';

interface DummyState {
  data: string[];
}

const initialState: DummyState = {
  data: [],
};

const dummyAction = actionCreatorFactory<string>('dummyAction').create();

const mutatingReducer = reducerFactory(initialState)
  .addMapper({
    filter: dummyAction,
    mapper: (state, action) => {
      state.data.push(action.payload);
      return state;
    },
  })
  .create();

const okReducer = reducerFactory(initialState)
  .addMapper({
    filter: dummyAction,
    mapper: (state, action) => {
      return {
        ...state,
        data: state.data.concat(action.payload),
      };
    },
  })
  .create();

describe('reducerTester', () => {
  describe('when reducer mutates state', () => {
    it('then it should throw', () => {
      expect(() => {
        reducerTester()
          .givenReducer(mutatingReducer, initialState)
          .whenActionIsDispatched(dummyAction('some string'));
      }).toThrow();
    });
  });

  describe('when reducer does not mutate state', () => {
    it('then it should not throw', () => {
      expect(() => {
        reducerTester()
          .givenReducer(okReducer, initialState)
          .whenActionIsDispatched(dummyAction('some string'));
      }).not.toThrow();
    });
  });
});
