import { wellFormedTree } from './fixtures/folders';

export const getFolderFixtures = wellFormedTree;
export { MOCK_TEAMS, MOCK_TEAM_GROUPS } from './fixtures/teams';
export {
  MOCK_SCOPES,
  MOCK_NODES,
  MOCK_SCOPE_DASHBOARD_BINDINGS,
  MOCK_SUB_SCOPE_MIMIR_ITEMS,
  MOCK_SUB_SCOPE_LOKI_ITEMS,
} from './fixtures/scopes';
export { default as allHandlers } from './handlers/all-handlers';
export { default as scopeHandlers } from './handlers/apis/scope.grafana.app/v0alpha1/handlers';
