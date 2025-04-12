import { configureStore as reduxConfigureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { Middleware } from 'redux';

import { browseDashboardsAPI } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { publicDashboardApi } from 'app/features/dashboard/api/publicDashboardApi';
import { cloudMigrationAPI } from 'app/features/migrate-to-cloud/api';
import { userPreferencesAPI } from 'app/features/preferences/api';
import { StoreState } from 'app/types/store';

import { advisorAPI } from '../api/clients/advisor';
import { folderAPI } from '../api/clients/folder';
import { iamAPI } from '../api/clients/iam';
import { playlistAPI } from '../api/clients/playlist';
import { provisioningAPI } from '../api/clients/provisioning';
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
        alertingApi.middleware,
        publicDashboardApi.middleware,
        browseDashboardsAPI.middleware,
        cloudMigrationAPI.middleware,
        userPreferencesAPI.middleware,
        iamAPI.middleware,
        playlistAPI.middleware,
        provisioningAPI.middleware,
        folderAPI.middleware,
        advisorAPI.middleware,
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
