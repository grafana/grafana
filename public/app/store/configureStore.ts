import { createStore, applyMiddleware, compose, combineReducers } from 'redux';
import thunk from 'redux-thunk';
import { createLogger } from 'redux-logger';
import sharedReducers from 'app/core/reducers';
import alertingReducers from 'app/features/alerting/state/reducers';
import teamsReducers from 'app/features/teams/state/reducers';
import apiKeysReducers from 'app/features/api-keys/state/reducers';
import foldersReducers from 'app/features/folders/state/reducers';
import dashboardReducers from 'app/features/dashboard/state/reducers';
import pluginReducers from 'app/features/plugins/state/reducers';
import dataSourcesReducers from 'app/features/datasources/state/reducers';
import usersReducers from 'app/features/users/state/reducers';

const rootReducers = {
  ...sharedReducers,
  ...alertingReducers,
  ...teamsReducers,
  ...apiKeysReducers,
  ...foldersReducers,
  ...dashboardReducers,
  ...pluginReducers,
  ...dataSourcesReducers,
  ...usersReducers,
};

export let store;

export function addRootReducer(reducers) {
  Object.assign(rootReducers, ...reducers);
}

export function configureStore() {
  const composeEnhancers = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

  const rootReducer = combineReducers(rootReducers);

  if (process.env.NODE_ENV !== 'production') {
    // DEV builds we had the logger middleware
    store = createStore(rootReducer, {}, composeEnhancers(applyMiddleware(thunk, createLogger())));
  } else {
    store = createStore(rootReducer, {}, composeEnhancers(applyMiddleware(thunk)));
  }
}
