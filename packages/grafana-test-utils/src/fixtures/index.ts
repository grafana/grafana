import { setupMockUserPreferences } from './preferences';
import { setupMockStarredDashboards, setupMockStarredFolders, setupMockStarredPluginKinds } from './starred';
import { setupMockTeams } from './teams';

/**
 * Reset any stateful fixtures that are used to drive mock handler endpoints
 */
export const resetFixtures = () => {
  setupMockStarredDashboards();
  setupMockStarredFolders();
  setupMockStarredPluginKinds();
  setupMockTeams();
  setupMockUserPreferences();
};
