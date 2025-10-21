import { configureStore as reduxConfigureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { Middleware } from 'redux';

import { notificationsAPIv0alpha1, rulesAPIv0alpha1 } from '@grafana/alerting/unstable';
import { allMiddleware as allApiClientMiddleware } from '@grafana/api-clients/rtkq';
import { legacyUserAPI } from 'app/api/legacy/user/api';
import { browseDashboardsAPI } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { publicDashboardApi } from 'app/features/dashboard/api/publicDashboardApi';
import { StoreState } from 'app/types/store';

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
        // @grafana/alerting clients for managing (Alertmanager) notification entities and rules
        notificationsAPIv0alpha1.middleware,
        rulesAPIv0alpha1.middleware,
        // other Grafana core APIs
        publicDashboardApi.middleware,
        browseDashboardsAPI.middleware,
        legacyUserAPI.middleware,
        ...allApiClientMiddleware,
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
