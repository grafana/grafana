export { BASE as PROVISIONING_API_BASE } from './apis/provisioning.grafana.app/v0alpha1/handlers';
export { FOLDER_BY_NAME as FOLDER_BY_NAME_URL } from './apis/folder.grafana.app/v1beta1/handlers';
export { USAGE_URL as QUOTAS_USAGE_URL } from './apis/quotas.grafana.app/v0alpha1/handlers';
export { MERGED_PREFS_URL, preferencesHandlers } from './apis/preferences.grafana.app/v1alpha1/handlers';
export {
  getCustomSearchHandler,
  searchRoute,
  getVectorSearchHandler,
  vectorSearchRoute,
} from './apis/dashboard.grafana.app/v0alpha1/handlers';
export { getSearchTeamsErrorHandler, getSearchTeamsHandler } from './api/teams/handlers';
export { getSignedInUserTeamListHandler } from './api/user/handlers';
export * as apiFoldersHandlers from './api/folders/handlers';
export { customLoginHandler } from './auth/handlers';
