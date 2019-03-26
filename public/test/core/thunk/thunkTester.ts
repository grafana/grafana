import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { ActionOf } from 'app/core/redux/actionCreatorFactory';

const mockStore = configureMockStore([thunk]);

export interface ThunkGiven {
  givenThunk: (thunkFunction: any) => ThunkWhen;
}

export interface ThunkWhen {
  whenThunkIsDispatched: (...args: any) => Promise<ThunkThen>;
}

export interface ThunkThen {
  thenDispatchedActionsEqual: (actions: Array<ActionOf<any>>) => void;
  thenDispatchedActionsAreEqual: (callback: (dispatchedActions: Array<ActionOf<any>>) => boolean) => void;
  thenThereAreNoDispatchedActions: () => void;
}

export const thunkTester = (initialState: any, debug?: boolean): ThunkGiven => {
  const store = mockStore(initialState);
  let thunkUnderTest = null;
  let resultingActions: Array<ActionOf<any>> = [];

  const givenThunk = (thunkFunction: any): ThunkWhen => {
    thunkUnderTest = thunkFunction;

    return instance;
  };

  const whenThunkIsDispatched = async (...args: any): Promise<ThunkThen> => {
    await store.dispatch(thunkUnderTest(...args));

    resultingActions = store.getActions();
    if (debug) {
      console.log('resultingActions:', resultingActions);
    }

    return instance;
  };

  const thenDispatchedActionsEqual = (actions: Array<ActionOf<any>>): void => {
    expect(resultingActions).toEqual(actions);
  };

  const thenDispatchedActionsAreEqual = (callback: (dispatchedActions: Array<ActionOf<any>>) => boolean): void => {
    expect(callback(resultingActions)).toBe(true);
  };

  const thenThereAreNoDispatchedActions = (): void => {
    return thenDispatchedActionsEqual([]);
  };

  const instance = {
    givenThunk,
    whenThunkIsDispatched,
    thenDispatchedActionsEqual,
    thenDispatchedActionsAreEqual,
    thenThereAreNoDispatchedActions,
  };

  return instance;
};
