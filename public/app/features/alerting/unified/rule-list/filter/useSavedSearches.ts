import {
  UseGenericSavedSearchesResult,
  createAppliedTracker,
  createAutoApplyTracker,
  createDefaultLoader,
  useGenericSavedSearches,
} from '../../hooks/useGenericSavedSearches';

export const RULES_SAVED_SEARCHES_STORAGE_KEY = 'savedSearches';

export interface UseSavedSearchesResult extends UseGenericSavedSearchesResult {}

/**
 * Hook for managing saved searches with UserStorage persistence.
 */
export function useSavedSearches(): UseSavedSearchesResult {
  return useGenericSavedSearches({
    storageKey: RULES_SAVED_SEARCHES_STORAGE_KEY,
  });
}

/**
 * Load the default saved search from storage.
 * Used by auto-apply hooks to load default search on first visit.
 */
export const loadDefaultSavedSearch = createDefaultLoader({
  storageKey: RULES_SAVED_SEARCHES_STORAGE_KEY,
});

export const trackSavedSearchApplied = createAppliedTracker();
export const trackSavedSearchAutoApply = createAutoApplyTracker();
