// @ts-ignore
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { ActionOf } from 'app/core/redux/actionCreatorFactory';

const mockStore = configureMockStore([thunk]);

export interface ThunkGiven {
  givenThunk: (thunkFunction: any) => ThunkWhen;
}

export interface ThunkWhen {
  whenThunkIsDispatched: (...args: any) => Promise<Array<ActionOf<any>>>;
}

export const thunkTester = (initialState: any, debug?: boolean): ThunkGiven => {
  const store = mockStore(initialState);
  let thunkUnderTest: any = null;
  let dispatchedActions: Array<ActionOf<any>> = [];

  const givenThunk = (thunkFunction: any): ThunkWhen => {
    thunkUnderTest = thunkFunction;

    return instance;
  };

  const whenThunkIsDispatched = async (...args: any): Promise<Array<ActionOf<any>>> => {
    await store.dispatch(thunkUnderTest(...args));

    dispatchedActions = store.getActions();
    if (debug) {
      console.log('resultingActions:', dispatchedActions);
    }

    return dispatchedActions;
  };

  const instance = {
    givenThunk,
    whenThunkIsDispatched,
  };

  return instance;
};
