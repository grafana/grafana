import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { ActionOf } from 'app/core/redux/actionCreatorFactory';

const mockStore = configureMockStore([thunk]);

export interface ThunkGiven {
  givenThunk: (thunkFunction: any) => ThunkWhen;
}

export interface ThunkWhen {
  whenThunkIsDispatched: (...args: any) => ThunkThen;
}

export interface ThunkThen {
  thenDispatchedActionsEqual: (actions: Array<ActionOf<any>>) => ThunkWhen;
  thenDispatchedActionsAreEqual: (callback: (actions: Array<ActionOf<any>>) => boolean) => ThunkWhen;
  thenThereAreNoDispatchedActions: () => ThunkWhen;
}

export const thunkTester = (initialState: any): ThunkGiven => {
  const store = mockStore(initialState);
  let thunkUnderTest = null;

  const givenThunk = (thunkFunction: any): ThunkWhen => {
    thunkUnderTest = thunkFunction;

    return instance;
  };

  function whenThunkIsDispatched(...args: any): ThunkThen {
    store.dispatch(thunkUnderTest(...arguments));

    return instance;
  }

  const thenDispatchedActionsEqual = (actions: Array<ActionOf<any>>): ThunkWhen => {
    const resultingActions = store.getActions();
    expect(resultingActions).toEqual(actions);

    return instance;
  };

  const thenDispatchedActionsAreEqual = (callback: (dispathedActions: Array<ActionOf<any>>) => boolean): ThunkWhen => {
    const resultingActions = store.getActions();
    expect(callback(resultingActions)).toBe(true);

    return instance;
  };

  const thenThereAreNoDispatchedActions = () => {
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
