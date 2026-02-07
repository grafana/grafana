import {
  UseGenericSavedSearchesResult,
  createAppliedTracker,
  createAutoApplyTracker,
  createDefaultLoader,
  useGenericSavedSearches,
} from '../../hooks/useGenericSavedSearches';

export const TRIAGE_SAVED_SEARCHES_STORAGE_KEY = 'triageSavedSearches';

export interface UseTriageSavedSearchesResult extends UseGenericSavedSearchesResult {}

/**
 * Hook for managing triage page saved searches with UserStorage persistence.
 */
export function useTriageSavedSearches(): UseTriageSavedSearchesResult {
  return useGenericSavedSearches({
    storageKey: TRIAGE_SAVED_SEARCHES_STORAGE_KEY,
    trackingContext: { page: 'triage' },
  });
}

/**
 * Load the default triage saved search from storage.
 * Used by auto-apply hooks to load default search on first visit.
 */
export const loadDefaultTriageSavedSearch = createDefaultLoader({
  storageKey: TRIAGE_SAVED_SEARCHES_STORAGE_KEY,
  trackingContext: { page: 'triage' },
});

export const trackTriageSavedSearchApplied = createAppliedTracker({ page: 'triage' });
export const trackTriageSavedSearchAutoApply = createAutoApplyTracker({ page: 'triage' });
