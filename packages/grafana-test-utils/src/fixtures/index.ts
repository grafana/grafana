import { setupMockUserPreferences } from './preferences';
import { setupMockStarredDashboards, setupMockStarredFolders, setupMockStarredPages } from './starred';
import { setupMockTeams } from './teams';

/**
 * Reset any stateful fixtures that are used to drive mock handler endpoints
 */
export const resetFixtures = () => {
  setupMockStarredDashboards();
  setupMockStarredFolders();
  setupMockStarredPages();
  setupMockTeams();
  setupMockUserPreferences();
};
