import { ReducersMapObject } from '@reduxjs/toolkit';
import { AnyAction, combineReducers } from 'redux';

import { alertingAPI as alertingPackageAPI } from '@grafana/alerting/unstable';
import sharedReducers from 'app/core/reducers';
import ldapReducers from 'app/features/admin/state/reducers';
import alertingReducers from 'app/features/alerting/state/reducers';
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

import { advisorAPIv0alpha1 } from '../../api/clients/advisor/v0alpha1';
import { folderAPIv1beta1 } from '../../api/clients/folder/v1beta1';
import { iamAPIv0alpha1 } from '../../api/clients/iam/v0alpha1';
import { playlistAPIv0alpha1 } from '../../api/clients/playlist/v0alpha1';
import { provisioningAPIv0alpha1 } from '../../api/clients/provisioning/v0alpha1';
import { alertingApi } from '../../features/alerting/unified/api/alertingApi';
import { userPreferencesAPI } from '../../features/preferences/api';
import { cleanUpAction } from '../actions/cleanUp';
// Used by the API client generator
// PLOP_INJECT_IMPORT

const rootReducers = {
  ...sharedReducers,
  ...alertingReducers,
  ...teamsReducers,
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
  [alertingPackageAPI.reducerPath]: alertingPackageAPI.reducer,
  [publicDashboardApi.reducerPath]: publicDashboardApi.reducer,
  [browseDashboardsAPI.reducerPath]: browseDashboardsAPI.reducer,
  [cloudMigrationAPI.reducerPath]: cloudMigrationAPI.reducer,
  [iamAPIv0alpha1.reducerPath]: iamAPIv0alpha1.reducer,
  [playlistAPIv0alpha1.reducerPath]: playlistAPIv0alpha1.reducer,
  [userPreferencesAPI.reducerPath]: userPreferencesAPI.reducer,
  [provisioningAPIv0alpha1.reducerPath]: provisioningAPIv0alpha1.reducer,
  [folderAPIv1beta1.reducerPath]: folderAPIv1beta1.reducer,
  [advisorAPIv0alpha1.reducerPath]: advisorAPIv0alpha1.reducer,
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
