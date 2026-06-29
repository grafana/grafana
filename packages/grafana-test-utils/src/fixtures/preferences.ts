import { type PreferencesSpec } from '@grafana/api-clients/rtkq/preferences/v1alpha1';

import { wellFormedTree } from './folders';

const [_, { dashbdD }] = wellFormedTree();

const initialUserPreferences = (): PreferencesSpec => ({
  homeDashboardUID: dashbdD.item.uid,
  theme: 'light',
  timezone: 'browser',
  weekStart: 'monday',
  language: '',
  queryHistory: { homeTab: '' },
  navbar: { bookmarkUrls: [] },
});

// Stable reference so importers see in-place mutations: the GET handler reads this object and the
// PATCH handler mutates it, so updates semi-persist within a test (reset between tests).
export const mockUserPreferences: PreferencesSpec = initialUserPreferences();

export const setupMockUserPreferences = () => {
  // A fresh initial object also gives navbar a new array, resetting bookmarkUrls.
  Object.assign(mockUserPreferences, initialUserPreferences());
};

/**
 * Seed the mock user preferences for a test. Merges the given fields into the current state so a
 * later GET reflects them — use this instead of mutating `mockUserPreferences` directly.
 */
export const setMockUserPreferences = (preferences: Partial<PreferencesSpec>) => {
  Object.assign(mockUserPreferences, preferences);
};
