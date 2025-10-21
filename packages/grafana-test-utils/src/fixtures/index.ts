import { setupMockStarredDashboards } from './starred';

/**
 * Reset any stateful fixtures that are used to drive mock handler endpoints
 */
export const resetFixtures = () => {
  setupMockStarredDashboards();
};
