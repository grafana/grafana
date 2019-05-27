import { createStore, applyMiddleware, compose, combineReducers } from 'redux';
import thunk from 'redux-thunk';
import { combineEpics, createEpicMiddleware } from 'redux-observable';
// import { createLogger } from 'redux-logger';
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
import { setStore } from './store';
import { startSubscriptionsEpic, startSubscriptionEpic, limitMessageRateEpic } from 'app/features/explore/state/epics';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';

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
};

export function addRootReducer(reducers) {
  Object.assign(rootReducers, ...reducers);
}

export const rootEpic: any = combineEpics(startSubscriptionsEpic, startSubscriptionEpic, limitMessageRateEpic);

export interface EpicDependencies {
  getWebSocket: <T>(urlConfigOrSource: string) => WebSocketSubject<T>;
}

const dependencies: EpicDependencies = {
  getWebSocket: webSocket,
};

const epicMiddleware = createEpicMiddleware({ dependencies });

export function configureStore() {
  const composeEnhancers = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

  const rootReducer = combineReducers(rootReducers);

  if (process.env.NODE_ENV !== 'production') {
    // DEV builds we had the logger middleware
    setStore(createStore(rootReducer, {}, composeEnhancers(applyMiddleware(thunk, epicMiddleware))));
  } else {
    setStore(createStore(rootReducer, {}, composeEnhancers(applyMiddleware(thunk, epicMiddleware))));
  }

  epicMiddleware.run(rootEpic);
}
