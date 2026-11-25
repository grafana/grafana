import { setupMockUserPreferences } from './preferences';
import { setupMockStars } from './starred';
import { setupMockTeams } from './teams';

/**
 * Reset any stateful fixtures that are used to drive mock handler endpoints
 */
export const resetFixtures = () => {
  setupMockStars();
  setupMockTeams();
  setupMockUserPreferences();
};
