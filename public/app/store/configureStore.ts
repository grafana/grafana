import { applyMiddleware, compose, createStore } from 'redux';
import thunk from 'redux-thunk';
import { createLogger } from 'redux-logger';

import { setStore } from './store';
import { StoreState } from 'app/types/store';
import { toggleLogActionsMiddleware } from 'app/core/middlewares/application';
import { addReducer, createRootReducer } from '../core/reducers/root';

export function addRootReducer(reducers: any) {
  // this is ok now because we add reducers before configureStore is called
  // in the future if we want to add reducers during runtime
  // we'll have to solve this in a more dynamic way
  addReducer(reducers);
}

export function configureStore() {
  const composeEnhancers = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

  const logger = createLogger({
    predicate: (getState: () => StoreState) => {
      return getState().application.logActions;
    },
  });
  const storeEnhancers =
    process.env.NODE_ENV !== 'production'
      ? applyMiddleware(toggleLogActionsMiddleware, thunk, logger)
      : applyMiddleware(thunk);

  const store: any = createStore(createRootReducer(), {}, composeEnhancers(storeEnhancers));
  setStore(store);
  return store;
}
