import { wellFormedTree } from './fixtures/folders';

export const getFolderFixtures = wellFormedTree;
export { MOCK_TEAMS, MOCK_TEAM_GROUPS } from './fixtures/teams';
export {
  MOCK_SCOPES,
  MOCK_NODES,
  MOCK_SCOPE_DASHBOARD_BINDINGS,
  MOCK_SUB_SCOPE_MIMIR_ITEMS,
  MOCK_SUB_SCOPE_LOKI_ITEMS,
  MOCK_DEFAULT_SCOPE,
} from './fixtures/scopes';
export { default as allHandlers } from './handlers/all-handlers';
export { default as scopeHandlers } from './handlers/apis/scope.grafana.app/v0alpha1/handlers';
export { customCreateTeamHandler } from './handlers/api/teams/handlers';
export { customGetUserPreferencesHandler, customPatchUserPreferencesHandler } from './handlers/api/user/handlers';
export { mockUserPreferences, setupMockUserPreferences, setMockUserPreferences } from './fixtures/preferences';
export { setMockStarredDashboards, setMockStarredFolders } from './fixtures/starred';
export { customSetTeamRolesHandler } from './handlers/api/access-control/handlers';
export { customCreateFolderHandler, customFolderCountsHandler } from './handlers/api/folders/handlers';
export { customCreateFolderHandler as customCreateFolderHandlerAppPlatform } from './handlers/apis/folder.grafana.app/v1beta1/handlers';

export * as folderHandlers from './handlers/apis/folder.grafana.app/v1beta1/handlers';

export { setTestFlags, getTestFeatureFlagClient } from './utilities/featureFlags';
export { mockLogger } from './utilities/mockLogger';
