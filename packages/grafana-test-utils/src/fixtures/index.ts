import { setupMockStarredDashboards } from './starred';
import { setupMockTeams } from './teams';

/**
 * Reset any stateful fixtures that are used to drive mock handler endpoints
 */
export const resetFixtures = () => {
  setupMockStarredDashboards();
  setupMockTeams();
};
