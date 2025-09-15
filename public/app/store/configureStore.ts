import { configureStore as reduxConfigureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { Middleware } from 'redux';

import { alertingAPI as alertingPackageAPI } from '@grafana/alerting/unstable';
import { dashboardAPIv0alpha1 } from 'app/api/clients/dashboard/v0alpha1';
import { rulesAPIv0alpha1 } from 'app/api/clients/rules/v0alpha1';
import { shortURLAPIv1alpha1 } from 'app/api/clients/shorturl/v1alpha1';
import { browseDashboardsAPI } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { publicDashboardApi } from 'app/features/dashboard/api/publicDashboardApi';
import { cloudMigrationAPI } from 'app/features/migrate-to-cloud/api';
import { userPreferencesAPI } from 'app/features/preferences/api';
import { StoreState } from 'app/types/store';

import { advisorAPIv0alpha1 } from '../api/clients/advisor/v0alpha1';
import { folderAPIv1beta1 } from '../api/clients/folder/v1beta1';
import { iamAPIv0alpha1 } from '../api/clients/iam/v0alpha1';
import { playlistAPIv0alpha1 } from '../api/clients/playlist/v0alpha1';
import { provisioningAPIv0alpha1 } from '../api/clients/provisioning/v0alpha1';
// Used by the API client generator
// PLOP_INJECT_IMPORT
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
        alertingPackageAPI.middleware,
        publicDashboardApi.middleware,
        browseDashboardsAPI.middleware,
        cloudMigrationAPI.middleware,
        userPreferencesAPI.middleware,
        iamAPIv0alpha1.middleware,
        playlistAPIv0alpha1.middleware,
        provisioningAPIv0alpha1.middleware,
        folderAPIv1beta1.middleware,
        advisorAPIv0alpha1.middleware,
        dashboardAPIv0alpha1.middleware,
        rulesAPIv0alpha1.middleware,
        shortURLAPIv1alpha1.middleware,
        // PLOP_INJECT_MIDDLEWARE
        // Used by the API client generator
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
