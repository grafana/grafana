import { configureStore as reduxConfigureStore } from '@reduxjs/toolkit';

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

export function configureStore(initialState?: Partial<StoreState>) {
  const store = reduxConfigureStore({
    reducer: createRootReducer(),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: true, serializableCheck: false, immutableCheck: false }).concat(
        alertingApi.middleware,
        publicDashboardApi.middleware,
        browseDashboardsAPI.middleware
      ),
    devTools: process.env.NODE_ENV !== 'production',
    preloadedState: {
      navIndex: buildInitialState(),
      ...initialState,
    },
  });

  setStore(store);
  return store;
}

export type RootState = ReturnType<ReturnType<typeof configureStore>['getState']>;
export type AppDispatch = ReturnType<typeof configureStore>['dispatch'];

/*
function getActionsToIgnoreSerializableCheckOn() {
  return [
    'dashboard/setPanelAngularComponent',
    'dashboard/panelModelAndPluginReady',
    'dashboard/dashboardInitCompleted',
    'plugins/panelPluginLoaded',
    'explore/initializeExplore',
    'explore/changeRange',
    'explore/updateDatasourceInstance',
    'explore/queryStoreSubscription',
    'explore/queryStreamUpdated',
  ];
}

function getPathsToIgnoreMutationAndSerializableCheckOn() {
  return [
    'plugins.panels',
    'dashboard.panels',
    'dashboard.getModel',
    'payload.plugin',
    'panelEditorNew.getPanel',
    'panelEditorNew.getSourcePanel',
    'panelEditorNew.getData',
    'explore.left.queryResponse',
    'explore.right.queryResponse',
    'explore.left.datasourceInstance',
    'explore.right.datasourceInstance',
    'explore.left.range',
    'explore.left.eventBridge',
    'explore.right.eventBridge',
    'explore.right.range',
    'explore.left.querySubscription',
    'explore.right.querySubscription',
  ];
}
*/
