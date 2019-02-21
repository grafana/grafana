import { reducerFactory } from './reducerFactory';
import { actionCreatorFactory, ActionOf, higherOrderActionCreatorFactory } from './actionCreatorFactory';

interface HigherOrderReducerState {
  children: number;
  [key: string]: ChildReducerState | number;
}

interface ChildReducerState {
  name: string;
  age: number;
}

const higherOrderReducerIntialState: HigherOrderReducerState = {
  children: 0,
};

const childReducerIntialState: ChildReducerState = {
  name: null,
  age: 0,
};

const lowerOrderActionCreator = actionCreatorFactory<number>('lower-order').create();
const higherOrderAction = higherOrderActionCreatorFactory<ChildReducerState>('higher-order').create();

const childReducer = reducerFactory(childReducerIntialState)
  .addHigherOrderMapper({
    filter: higherOrderAction,
    mapper: (state, action) => ({ ...state, name: action.payload.name, age: action.payload.age }),
  })
  .create();

const parentReducer = reducerFactory(higherOrderReducerIntialState)
  .addMapper({
    filter: lowerOrderActionCreator,
    mapper: (state, action) => ({ ...state, children: action.payload }),
  })
  .addReducer(childReducer)
  .create();

describe('reducerFactory', () => {
  describe('given it is created with a defined mapper', () => {
    describe('when reducer is called with no state', () => {
      describe('and with an action that the mapper can not handle', () => {
        it('then the resulting state should be intial state', () => {
          const result = parentReducer(undefined as HigherOrderReducerState, {} as ActionOf<any>);

          expect(result).toEqual(higherOrderReducerIntialState);
        });
      });

      describe('and with an action that the mapper can handle', () => {
        it('then the resulting state should correct', () => {
          const result = parentReducer(undefined as HigherOrderReducerState, lowerOrderActionCreator(1));

          expect(result).toEqual({ children: 1 });
        });
      });

      describe('and with an action that a child reducer mapper can handle', () => {
        it('then the resulting state should correct', () => {
          const result = parentReducer(
            undefined as HigherOrderReducerState,
            higherOrderAction('someId')({ age: 2, name: 'Kim' })
          );

          expect(result).toEqual({ children: 0, someId: { age: 2, name: 'Kim' } });
        });
      });

      describe('and with an action that a child reducer mapper can handle but missing action.id', () => {
        it('then the resulting state should correct', () => {
          const result = parentReducer(
            undefined as HigherOrderReducerState,
            higherOrderAction(undefined)({ age: 2, name: 'Kim' })
          );

          expect(result).toEqual({ children: 0 });
        });
      });
    });

    describe('when reducer is called with a state', () => {
      describe('and with an action that the mapper can not handle', () => {
        it('then the resulting state should be intial state', () => {
          const result = parentReducer(higherOrderReducerIntialState, {} as ActionOf<any>);

          expect(result).toEqual(higherOrderReducerIntialState);
        });
      });

      describe('and with an action that the mapper can handle', () => {
        it('then the resulting state should correct', () => {
          const result = parentReducer(higherOrderReducerIntialState, lowerOrderActionCreator(2));

          expect(result).toEqual({ children: 2 });
        });
      });

      describe('and with an action that a child reducer mapper can handle', () => {
        it('then the resulting state should correct', () => {
          const result = parentReducer(
            higherOrderReducerIntialState,
            higherOrderAction('someId')({ age: 4, name: 'Adrian' })
          );

          expect(result).toEqual({ children: 0, someId: { age: 4, name: 'Adrian' } });
        });
      });

      describe('and with an action that a child reducer mapper can handle but missing action.id', () => {
        it('then the resulting state should correct', () => {
          const result = parentReducer(
            higherOrderReducerIntialState,
            higherOrderAction(undefined)({ age: 4, name: 'Adrian' })
          );

          expect(result).toEqual({ children: 0 });
        });
      });
    });
  });

  describe('given a mapper is added', () => {
    describe('when a mapper with the same creator is added', () => {
      it('then is should throw', () => {
        const faultyReducer = reducerFactory(higherOrderReducerIntialState).addMapper({
          filter: lowerOrderActionCreator,
          mapper: (state, action) => {
            return { ...state, children: action.payload };
          },
        });

        expect(() => {
          faultyReducer.addMapper({
            filter: lowerOrderActionCreator,
            mapper: state => {
              return state;
            },
          });
        }).toThrow();
      });
    });
  });
});
