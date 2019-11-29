import { configureStore as rtkConfigureStore } from '@reduxjs/toolkit';
import thunk from 'redux-thunk';

import { setStore } from './store';
import { StoreState } from 'app/types/store';
import { addReducer, createRootReducer } from '../core/reducers/root';
import { ActionOf } from 'app/core/redux';
import { toggleLogActionsMiddleware } from '../core/middlewares/application';
import { createLogger } from 'redux-logger';

export function addRootReducer(reducers: any) {
  // this is ok now because we add reducers before configureStore is called
  // in the future if we want to add reducers during runtime
  // we'll have to solve this in a more dynamic way
  addReducer(reducers);
}

export function configureStore() {
  const logger = createLogger({
    predicate: (getState: () => StoreState) => {
      return getState().application.logActions;
    },
  });

  const store = rtkConfigureStore<StoreState, ActionOf<any>>({
    reducer: createRootReducer(),
    middleware: process.env.NODE_ENV !== 'production' ? [toggleLogActionsMiddleware, thunk, logger] : [thunk],
  });

  setStore(store);
  return store;
}
