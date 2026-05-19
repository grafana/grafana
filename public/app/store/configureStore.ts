import { configureStore as reduxConfigureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { type Middleware } from 'redux';

import { generatedAPI as migrateToCloudAPI } from '@grafana/api-clients/internal/rtkq/legacy/migrate-to-cloud';
import { generatedAPI as preferencesUserAPI } from '@grafana/api-clients/internal/rtkq/legacy/preferences/user';
import { generatedAPI as legacyUserAPI } from '@grafana/api-clients/internal/rtkq/legacy/user';
import { allMiddleware as allApiClientMiddleware } from '@grafana/api-clients/rtkq';
import { legacyAPI } from 'app/api/clients/legacy';
import { scopeAPIv0alpha1 } from 'app/api/clients/scope/v0alpha1';
import { browseDashboardsAPI } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { publicDashboardApi } from 'app/features/dashboard/api/publicDashboardApi';
import { type StoreState } from 'app/types/store';

import { buildInitialState } from '../core/reducers/navModel';
import { addReducer, createRootReducer } from '../core/reducers/root';
import { alertingApi } from '../features/alerting/unified/api/alertingApi';

import { setStore } from './store';

export function addRootReducer(reducers: any) {
  // this is ok now because we add reducers before configureStore is called
  // in the future if we want to add reducers during runtime
  // we'll have to solve this in a more dynamic way
  addReducer(reducers);
}

const listenerMiddleware = createListenerMiddleware();
const extraMiddleware: Middleware[] = [];

export function addExtraMiddleware(middleware: Middleware) {
  extraMiddleware.push(middleware);
}

export function configureStore(initialState?: Partial<StoreState>) {
  const store = reduxConfigureStore({
    reducer: createRootReducer(),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: true, serializableCheck: false, immutableCheck: false }).concat(
        listenerMiddleware.middleware,

        // older internal alerting API client
        alertingApi.middleware,

        // API clients that are not in the api-clients package
        // Anything here is likely to be deprecated
        publicDashboardApi.middleware,
        browseDashboardsAPI.middleware,

        // Legacy API clients that come from the api-clients package
        // (these are not exported in the same way as we avoid including them in the published package)
        legacyAPI.middleware,
        migrateToCloudAPI.middleware,
        preferencesUserAPI.middleware,
        legacyUserAPI.middleware,

        // Enterprise API clients from the api-clients package
        scopeAPIv0alpha1.middleware,

        // All api-clients from the api-clients package
        ...allApiClientMiddleware,

        // Any additional other middleware, configured from enterprise
        ...extraMiddleware
      ),
    devTools: process.env.NODE_ENV !== 'production',
    preloadedState: {
      navIndex: buildInitialState(),
      ...initialState,
    },
  });

  // this enables "refetchOnFocus" and "refetchOnReconnect" for RTK Query
  setupListeners(store.dispatch);

  setStore(store);
  return store;
}

export type RootState = ReturnType<ReturnType<typeof configureStore>['getState']>;
export type AppDispatch = ReturnType<typeof configureStore>['dispatch'];
