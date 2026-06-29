import {
  type UseGenericSavedSearchesResult,
  createAppliedTracker,
  createAutoApplyTracker,
  createDefaultLoader,
  useGenericSavedSearches,
} from '../../hooks/useGenericSavedSearches';

// A dedicated storage key keeps Alert quality saved searches separate from the
// rule list ('savedSearches') and triage ('triageSavedSearches') ones.
const QUALITY_SAVED_SEARCHES_STORAGE_KEY = 'alertQualitySavedSearches';

export interface UseQualitySavedSearchesResult extends UseGenericSavedSearchesResult {}

/**
 * Manages saved searches for the Alert quality tab, persisted per-user via UserStorage.
 */
export function useQualitySavedSearches(): UseQualitySavedSearchesResult {
  return useGenericSavedSearches({
    storageKey: QUALITY_SAVED_SEARCHES_STORAGE_KEY,
    trackingContext: { page: 'alertQuality' },
  });
}

/**
 * Load the default Alert quality saved search from storage.
 * Used by the auto-apply hook to apply the default search on first visit.
 */
export const loadDefaultQualitySearch = createDefaultLoader({
  storageKey: QUALITY_SAVED_SEARCHES_STORAGE_KEY,
});

export const trackQualitySavedSearchApplied = createAppliedTracker({ page: 'alertQuality' });
export const trackQualitySavedSearchAutoApply = createAutoApplyTracker({ page: 'alertQuality' });
