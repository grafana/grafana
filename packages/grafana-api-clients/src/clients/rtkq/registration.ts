/**
 * Registers API infrastructure without loading feature endpoint definitions.
 * Use the `generate:api-client` command to add new API clients.
 */
import { api as advisorAPIv0alpha1 } from './advisor/v0alpha1/baseAPI';
import { api as collectionsAPIv1alpha1 } from './collections/v1alpha1/baseAPI';
import { api as correlationsAPIv0alpha1 } from './correlations/v0alpha1/baseAPI';
import { api as dashboardAPIv0alpha1 } from './dashboard/v0alpha1/baseAPI';
import { api as dashboardAPIv1beta1 } from './dashboard/v1beta1/baseAPI';
import { api as dashboardAPIv2 } from './dashboard/v2/baseAPI';
import { api as dashboardAPIv2beta1 } from './dashboard/v2beta1/baseAPI';
import { api as folderAPIv1beta1 } from './folder/v1beta1/baseAPI';
import { api as historianAlertingAPIv0alpha1 } from './historian.alerting/v0alpha1/baseAPI';
import { api as iamAPIv0alpha1 } from './iam/v0alpha1/baseAPI';
import { api as logsdrilldownAPIv1alpha1 } from './logsdrilldown/v1alpha1/baseAPI';
import { api as logsdrilldownAPIv1beta1 } from './logsdrilldown/v1beta1/baseAPI';
import { api as notificationsAlertingAPIv0alpha1 } from './notifications.alerting/v0alpha1/baseAPI';
import { api as notificationsAlertingAPIv1beta1 } from './notifications.alerting/v1beta1/baseAPI';
import { api as playlistAPIv1 } from './playlist/v1/baseAPI';
import { api as pluginsAPIv0alpha1 } from './plugins/v0alpha1/baseAPI';
import { api as orgPreferencesAPI } from './preferences/org/baseAPI';
import { api as teamPreferencesAPI } from './preferences/team/baseAPI';
import { api as preferencesAPIv1 } from './preferences/v1/baseAPI';
import { api as preferencesAPIv1alpha1 } from './preferences/v1alpha1/baseAPI';
import { api as provisioningAPIv0alpha1 } from './provisioning/v0alpha1/baseAPI';
import { api as quotasAPIv0alpha1 } from './quotas/v0alpha1/baseAPI';
import { api as rulesAlertingAPIv0alpha1 } from './rules.alerting/v0alpha1/baseAPI';
import { api as shortURLAPIv1beta1 } from './shorturl/v1beta1/baseAPI';
// GENERATED:IMPORT

export const allMiddleware = [
  advisorAPIv0alpha1.middleware,
  dashboardAPIv0alpha1.middleware,
  folderAPIv1beta1.middleware,
  iamAPIv0alpha1.middleware,
  playlistAPIv1.middleware,
  collectionsAPIv1alpha1.middleware,
  preferencesAPIv1alpha1.middleware,
  provisioningAPIv0alpha1.middleware,
  shortURLAPIv1beta1.middleware,
  correlationsAPIv0alpha1.middleware,
  notificationsAlertingAPIv0alpha1.middleware,
  rulesAlertingAPIv0alpha1.middleware,
  historianAlertingAPIv0alpha1.middleware,
  logsdrilldownAPIv1beta1.middleware,
  logsdrilldownAPIv1alpha1.middleware,
  quotasAPIv0alpha1.middleware,
  orgPreferencesAPI.middleware,
  teamPreferencesAPI.middleware,
  notificationsAlertingAPIv1beta1.middleware,
  dashboardAPIv1beta1.middleware,
  dashboardAPIv2.middleware,
  dashboardAPIv2beta1.middleware,
  pluginsAPIv0alpha1.middleware,
  preferencesAPIv1.middleware,
  // GENERATED:MIDDLEWARE
] as const;

export const allReducers = {
  [advisorAPIv0alpha1.reducerPath]: advisorAPIv0alpha1.reducer,
  [dashboardAPIv0alpha1.reducerPath]: dashboardAPIv0alpha1.reducer,
  [folderAPIv1beta1.reducerPath]: folderAPIv1beta1.reducer,
  [iamAPIv0alpha1.reducerPath]: iamAPIv0alpha1.reducer,
  [playlistAPIv1.reducerPath]: playlistAPIv1.reducer,
  [collectionsAPIv1alpha1.reducerPath]: collectionsAPIv1alpha1.reducer,
  [preferencesAPIv1alpha1.reducerPath]: preferencesAPIv1alpha1.reducer,
  [provisioningAPIv0alpha1.reducerPath]: provisioningAPIv0alpha1.reducer,
  [shortURLAPIv1beta1.reducerPath]: shortURLAPIv1beta1.reducer,
  [correlationsAPIv0alpha1.reducerPath]: correlationsAPIv0alpha1.reducer,
  [notificationsAlertingAPIv0alpha1.reducerPath]: notificationsAlertingAPIv0alpha1.reducer,
  [rulesAlertingAPIv0alpha1.reducerPath]: rulesAlertingAPIv0alpha1.reducer,
  [historianAlertingAPIv0alpha1.reducerPath]: historianAlertingAPIv0alpha1.reducer,
  [logsdrilldownAPIv1alpha1.reducerPath]: logsdrilldownAPIv1alpha1.reducer,
  [logsdrilldownAPIv1beta1.reducerPath]: logsdrilldownAPIv1beta1.reducer,
  [quotasAPIv0alpha1.reducerPath]: quotasAPIv0alpha1.reducer,
  [orgPreferencesAPI.reducerPath]: orgPreferencesAPI.reducer,
  [teamPreferencesAPI.reducerPath]: teamPreferencesAPI.reducer,
  [notificationsAlertingAPIv1beta1.reducerPath]: notificationsAlertingAPIv1beta1.reducer,
  [dashboardAPIv1beta1.reducerPath]: dashboardAPIv1beta1.reducer,
  [dashboardAPIv2.reducerPath]: dashboardAPIv2.reducer,
  [dashboardAPIv2beta1.reducerPath]: dashboardAPIv2beta1.reducer,
  [pluginsAPIv0alpha1.reducerPath]: pluginsAPIv0alpha1.reducer,
  [preferencesAPIv1.reducerPath]: preferencesAPIv1.reducer,
  // GENERATED:REDUCER
};
