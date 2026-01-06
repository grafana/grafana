import { ReducersMapObject } from '@reduxjs/toolkit';
import { Action as AnyAction, combineReducers } from 'redux';

const addedReducers = {
  defaultReducer: (state = {}) => state,
  templating: (state = { lastKey: 'key' }) => state,
};

export const addReducer = (newReducers: ReducersMapObject) => {
  Object.assign(addedReducers, newReducers);
};

export const createRootReducer = () => {
  const appReducer = combineReducers({
    ...addedReducers,
  });

  return (state: Parameters<typeof appReducer>[0], action: AnyAction) => {

    return appReducer(state, action);
  };
};
