import { createStore, applyMiddleware, compose, combineReducers } from 'redux';
import thunk from 'redux-thunk';
import { createLogger } from 'redux-logger';
import sharedReducers from 'app/core/reducers';
import alertingReducers from 'app/features/alerting/state/reducers';
import teamsReducers from 'app/features/teams/state/reducers';
import apiKeysReducers from 'app/features/api-keys/state/reducers';
import foldersReducers from 'app/features/folders/state/reducers';
import dashboardReducers from 'app/features/dashboard/state/reducers';
import exploreReducers from 'app/features/explore/state/reducers';
import pluginReducers from 'app/features/plugins/state/reducers';
import dataSourcesReducers from 'app/features/datasources/state/reducers';
import usersReducers from 'app/features/users/state/reducers';
import userReducers from 'app/features/profile/state/reducers';
import organizationReducers from 'app/features/org/state/reducers';
import ldapReducers from 'app/features/admin/state/reducers';
import { setStore } from './store';
import { StoreState } from 'app/types/store';
import { toggleLogActionsMiddleware } from 'app/core/middlewares/application';
import { ActionOf } from '../core/redux';
import { cleanUpAction, CleanUp } from '../core/actions/cleanUp';

const rootReducers = {
  ...sharedReducers,
  ...alertingReducers,
  ...teamsReducers,
  ...apiKeysReducers,
  ...foldersReducers,
  ...dashboardReducers,
  ...exploreReducers,
  ...pluginReducers,
  ...dataSourcesReducers,
  ...usersReducers,
  ...userReducers,
  ...organizationReducers,
  ...ldapReducers,
};

export function addRootReducer(reducers: any) {
  Object.assign(rootReducers, ...reducers);
}

const recursiveCleanState = (state: any, stateSlice: any): boolean => {
  for (const stateKey in state) {
    if (state[stateKey] === stateSlice) {
      state[stateKey] = undefined;
      return true;
    }

    if (typeof state[stateKey] === 'object') {
      const cleaned = recursiveCleanState(state[stateKey], stateSlice);
      if (cleaned) {
        return true;
      }
    }
  }

  return false;
};

export function configureStore() {
  const composeEnhancers = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
  const appReducer = combineReducers(rootReducers);
  const rootReducer = (state: any, action: ActionOf<any>): StoreState => {
    if (action.type !== cleanUpAction.type) {
      return appReducer(state, action);
    }

    const { stateSelector } = action.payload as CleanUp<any>;
    const stateSlice = stateSelector(state);
    recursiveCleanState(state, stateSlice);

    return appReducer(state, action);
  };

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
