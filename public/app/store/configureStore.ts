import { configureStore as reduxConfigureStore } from '@reduxjs/toolkit';
import { createLogger } from 'redux-logger';
import thunk from 'redux-thunk';

import { setStore } from './store';
import { StoreState } from 'app/types/store';
import { toggleLogActionsMiddleware } from 'app/core/middlewares/application';
import { addReducer, createRootReducer } from '../core/reducers/root';
import { buildInitialState } from '../core/reducers/navModel';

export function addRootReducer(reducers: any) {
  // this is ok now because we add reducers before configureStore is called
  // in the future if we want to add reducers during runtime
  // we'll have to solve this in a more dynamic way
  addReducer(reducers);
}

export function configureStore() {
  const logger = createLogger({
    predicate: getState => {
      return getState().application.logActions;
    },
  });

  const middleware = process.env.NODE_ENV !== 'production' ? [toggleLogActionsMiddleware, thunk, logger] : [thunk];

  const store = reduxConfigureStore<StoreState>({
    reducer: createRootReducer(),
    middleware,
    devTools: process.env.NODE_ENV !== 'production',
    preloadedState: {
      navIndex: buildInitialState(),
    },
  });

  setStore(store);
  return store;
}
