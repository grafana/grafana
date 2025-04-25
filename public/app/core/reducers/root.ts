import { ReducersMapObject } from '@reduxjs/toolkit';
import { AnyAction, combineReducers } from 'redux';

import sharedReducers from 'app/core/reducers';
import ldapReducers from 'app/features/admin/state/reducers';
import alertingReducers from 'app/features/alerting/state/reducers';
import apiKeysReducers from 'app/features/api-keys/state/reducers';
import authConfigReducers from 'app/features/auth-config/state/reducers';
import { browseDashboardsAPI } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import browseDashboardsReducers from 'app/features/browse-dashboards/state/slice';
import { publicDashboardApi } from 'app/features/dashboard/api/publicDashboardApi';
import panelEditorReducers from 'app/features/dashboard/components/PanelEditor/state/reducers';
import dashboardReducers from 'app/features/dashboard/state/reducers';
import dataSourcesReducers from 'app/features/datasources/state/reducers';
import exploreReducers from 'app/features/explore/state/main';
import foldersReducers from 'app/features/folders/state/reducers';
import invitesReducers from 'app/features/invites/state/reducers';
import importDashboardReducers from 'app/features/manage-dashboards/state/reducers';
import { cloudMigrationAPI } from 'app/features/migrate-to-cloud/api';
import organizationReducers from 'app/features/org/state/reducers';
import panelsReducers from 'app/features/panel/state/reducers';
import { reducer as pluginsReducer } from 'app/features/plugins/admin/state/reducer';
import userReducers from 'app/features/profile/state/reducers';
import serviceAccountsReducer from 'app/features/serviceaccounts/state/reducers';
import supportBundlesReducer from 'app/features/support-bundles/state/reducers';
import teamsReducers from 'app/features/teams/state/reducers';
import usersReducers from 'app/features/users/state/reducers';
import templatingReducers from 'app/features/variables/state/keyedVariablesReducer';

import { advisorAPI } from '../../api/clients/advisor';
import { folderAPI } from '../../api/clients/folder';
import { iamAPI } from '../../api/clients/iam';
import { playlistAPI } from '../../api/clients/playlist';
import { provisioningAPI } from '../../api/clients/provisioning';
import { reportingAPI } from '../../api/clients/reporting/baseAPI';
import { alertingApi } from '../../features/alerting/unified/api/alertingApi';
import { userPreferencesAPI } from '../../features/preferences/api';
import { cleanUpAction } from '../actions/cleanUp';
// Used by the API client generator
// PLOP_INJECT_IMPORT

const rootReducers = {
  ...sharedReducers,
  ...alertingReducers,
  ...teamsReducers,
  ...apiKeysReducers,
  ...foldersReducers,
  ...dashboardReducers,
  ...exploreReducers,
  ...dataSourcesReducers,
  ...usersReducers,
  ...serviceAccountsReducer,
  ...userReducers,
  ...invitesReducers,
  ...organizationReducers,
  ...browseDashboardsReducers,
  ...ldapReducers,
  ...importDashboardReducers,
  ...panelEditorReducers,
  ...panelsReducers,
  ...templatingReducers,
  ...supportBundlesReducer,
  ...authConfigReducers,
  plugins: pluginsReducer,
  [alertingApi.reducerPath]: alertingApi.reducer,
  [publicDashboardApi.reducerPath]: publicDashboardApi.reducer,
  [browseDashboardsAPI.reducerPath]: browseDashboardsAPI.reducer,
  [cloudMigrationAPI.reducerPath]: cloudMigrationAPI.reducer,
  [iamAPI.reducerPath]: iamAPI.reducer,
  [playlistAPI.reducerPath]: playlistAPI.reducer,
  [userPreferencesAPI.reducerPath]: userPreferencesAPI.reducer,
  [provisioningAPI.reducerPath]: provisioningAPI.reducer,
  [folderAPI.reducerPath]: folderAPI.reducer,
  [advisorAPI.reducerPath]: advisorAPI.reducer,
  [reportingAPI.reducerPath]: reportingAPI.reducer,
  // PLOP_INJECT_REDUCER
  // Used by the API client generator
};

const addedReducers = {};

export const addReducer = (newReducers: ReducersMapObject) => {
  Object.assign(addedReducers, newReducers);
};

export const createRootReducer = () => {
  const appReducer = combineReducers({
    ...rootReducers,
    ...addedReducers,
  });

  return (state: Parameters<typeof appReducer>[0], action: AnyAction) => {
    if (action.type !== cleanUpAction.type) {
      return appReducer(state, action);
    }

    const { cleanupAction } = action.payload;
    cleanupAction(state);

    return appReducer(state, action);
  };
};
