/**
 * Don't manually add to this file! Use the `generate:api-client` command to add new API clients.
 */
import { generatedAPI as advisorAPIv0alpha1 } from './clients/rtkq/advisor/v0alpha1';
import { generatedAPI as correlationsAPIv0alpha1 } from './clients/rtkq/correlations/v0alpha1';
import { generatedAPI as dashboardAPIv0alpha1 } from './clients/rtkq/dashboard/v0alpha1';
import { generatedAPI as folderAPIv1beta1 } from './clients/rtkq/folder/v1beta1';
import { generatedAPI as iamAPIv0alpha1 } from './clients/rtkq/iam/v0alpha1';
import { generatedAPI as migrateToCloudAPI } from './clients/rtkq/migrate-to-cloud';
import { generatedAPI as playlistAPIv0alpha1 } from './clients/rtkq/playlist/v0alpha1';
import { generatedAPI as preferencesUserAPI } from './clients/rtkq/preferences/user';
import { generatedAPI as preferencesAPIv1alpha1 } from './clients/rtkq/preferences/v1alpha1';
import { generatedAPI as provisioningAPIv0alpha1 } from './clients/rtkq/provisioning/v0alpha1';
import { generatedAPI as shortURLAPIv1alpha1 } from './clients/rtkq/shorturl/v1alpha1';
// PLOP_INJECT_IMPORT

/** RTK Query middleware for all API clients  */
export const allMiddleware = [
  advisorAPIv0alpha1.middleware,
  dashboardAPIv0alpha1.middleware,
  folderAPIv1beta1.middleware,
  iamAPIv0alpha1.middleware,
  migrateToCloudAPI.middleware,
  playlistAPIv0alpha1.middleware,
  preferencesAPIv1alpha1.middleware,
  preferencesUserAPI.middleware,
  provisioningAPIv0alpha1.middleware,
  shortURLAPIv1alpha1.middleware,
  correlationsAPIv0alpha1.middleware,
  // PLOP_INJECT_MIDDLEWARE
] as const;

/** RTK Query reducers for all API clients  */
export const allReducers = {
  [advisorAPIv0alpha1.reducerPath]: advisorAPIv0alpha1.reducer,
  [dashboardAPIv0alpha1.reducerPath]: dashboardAPIv0alpha1.reducer,
  [folderAPIv1beta1.reducerPath]: folderAPIv1beta1.reducer,
  [iamAPIv0alpha1.reducerPath]: iamAPIv0alpha1.reducer,
  [migrateToCloudAPI.reducerPath]: migrateToCloudAPI.reducer,
  [playlistAPIv0alpha1.reducerPath]: playlistAPIv0alpha1.reducer,
  [preferencesAPIv1alpha1.reducerPath]: preferencesAPIv1alpha1.reducer,
  [preferencesUserAPI.reducerPath]: preferencesUserAPI.reducer,
  [provisioningAPIv0alpha1.reducerPath]: provisioningAPIv0alpha1.reducer,
  [shortURLAPIv1alpha1.reducerPath]: shortURLAPIv1alpha1.reducer,
  [correlationsAPIv0alpha1.reducerPath]: correlationsAPIv0alpha1.reducer,
  // PLOP_INJECT_REDUCER
};
