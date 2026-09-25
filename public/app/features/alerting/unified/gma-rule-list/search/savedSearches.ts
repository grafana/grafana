import { type UseGenericSavedSearchesResult, createDefaultLoader, useGenericSavedSearches } from '../../hooks/useGenericSavedSearches';

import { ALERT_SAVED_SEARCHES_STORAGE_KEY, RECORDING_SAVED_SEARCHES_STORAGE_KEY } from './savedSearchesMigration';

/**
 * Separate Alert/Recording saved-search collections, each with its own default — reuses the
 * same generic UserStorage-backed hook the combined list's saved searches use, just under a
 * new storage key per page. Call `copyLegacySavedSearchesOnce` (savedSearchesMigration.ts)
 * once and await it before first mounting either of these, so the legacy collection has
 * already been copied in by the time this hook's initial load reads storage.
 */
export function useAlertRulesSavedSearches(): UseGenericSavedSearchesResult {
  return useGenericSavedSearches({ storageKey: ALERT_SAVED_SEARCHES_STORAGE_KEY });
}

export function useRecordingRulesSavedSearches(): UseGenericSavedSearchesResult {
  return useGenericSavedSearches({ storageKey: RECORDING_SAVED_SEARCHES_STORAGE_KEY });
}

export const loadDefaultAlertRulesSavedSearch = createDefaultLoader({ storageKey: ALERT_SAVED_SEARCHES_STORAGE_KEY });
export const loadDefaultRecordingRulesSavedSearch = createDefaultLoader({ storageKey: RECORDING_SAVED_SEARCHES_STORAGE_KEY });
