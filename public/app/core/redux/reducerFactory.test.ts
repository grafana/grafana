import { reducerFactory } from './reducerFactory';
import { actionCreatorFactory, ActionOf } from './actionCreatorFactory';

interface DummyReducerState {
  n: number;
  s: string;
  b: boolean;
  o: {
    n: number;
    s: string;
    b: boolean;
  };
}

const dummyReducerIntialState: DummyReducerState = {
  n: 1,
  s: 'One',
  b: true,
  o: {
    n: 2,
    s: 'two',
    b: false,
  },
};

const dummyActionCreator = actionCreatorFactory<DummyReducerState>('dummy').create();

const dummyReducer = reducerFactory(dummyReducerIntialState)
  .addMapper({
    filter: dummyActionCreator,
    mapper: (state, action) => ({ ...state, ...action.payload }),
  })
  .create();

describe('reducerFactory', () => {
  describe('given it is created with a defined handler', () => {
    describe('when reducer is called with no state', () => {
      describe('and with an action that the handler can not handle', () => {
        it('then the resulting state should be intial state', () => {
          const result = dummyReducer(undefined as DummyReducerState, {} as ActionOf<any>);

          expect(result).toEqual(dummyReducerIntialState);
        });
      });

      describe('and with an action that the handler can handle', () => {
        it('then the resulting state should correct', () => {
          const payload = { n: 10, s: 'ten', b: false, o: { n: 20, s: 'twenty', b: true } };
          const result = dummyReducer(undefined as DummyReducerState, dummyActionCreator(payload));

          expect(result).toEqual(payload);
        });
      });
    });

    describe('when reducer is called with a state', () => {
      describe('and with an action that the handler can not handle', () => {
        it('then the resulting state should be intial state', () => {
          const result = dummyReducer(dummyReducerIntialState, {} as ActionOf<any>);

          expect(result).toEqual(dummyReducerIntialState);
        });
      });

      describe('and with an action that the handler can handle', () => {
        it('then the resulting state should correct', () => {
          const payload = { n: 10, s: 'ten', b: false, o: { n: 20, s: 'twenty', b: true } };
          const result = dummyReducer(dummyReducerIntialState, dummyActionCreator(payload));

          expect(result).toEqual(payload);
        });
      });
    });
  });

  describe('given a handler is added', () => {
    describe('when a handler with the same creator is added', () => {
      it('then is should throw', () => {
        const faultyReducer = reducerFactory(dummyReducerIntialState).addMapper({
          filter: dummyActionCreator,
          mapper: (state, action) => {
            return { ...state, ...action.payload };
          },
        });

        expect(() => {
          faultyReducer.addMapper({
            filter: dummyActionCreator,
            mapper: state => {
              return state;
            },
          });
        }).toThrow();
      });
    });
  });
});
