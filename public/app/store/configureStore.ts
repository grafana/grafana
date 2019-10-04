import { applyMiddleware, compose, createStore } from 'redux';
import thunk from 'redux-thunk';
import { createLogger } from 'redux-logger';

import { setStore } from './store';
import { StoreState } from 'app/types/store';
import { toggleLogActionsMiddleware } from 'app/core/middlewares/application';
import { rootReducer } from '../core/reducers/root';

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

  const store = createStore(rootReducer, {}, composeEnhancers(storeEnhancers));
  setStore(store);
  return store;
}
