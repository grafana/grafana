import { SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import {
  UseGenericSavedSearchesResult,
  createAppliedTracker,
  createAutoApplyTracker,
  createStorageLoader,
  useGenericSavedSearches,
} from '../../hooks/useGenericSavedSearches';
import { getTriagePredefinedSearches } from '../triagePredefinedSearches';

import { createPredefinedOverridesLoader } from './useTriagePredefinedOverrides';

export const TRIAGE_SAVED_SEARCHES_STORAGE_KEY = 'triageSavedSearches';

const TRIAGE_CONFIG = {
  storageKey: TRIAGE_SAVED_SEARCHES_STORAGE_KEY,
  trackingContext: { page: 'triage' as const },
};

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
export async function loadDefaultTriageSavedSearch(): Promise<SavedSearch | null> {
  const loadOverrides = createPredefinedOverridesLoader();
  const { defaultSearchId: defaultId } = await loadOverrides();

  const loadSavedSearches = createStorageLoader(TRIAGE_CONFIG);

  if (defaultId != null) {
    const predefined = getTriagePredefinedSearches();
    const fromPredefined = predefined.find((s) => s.id === defaultId);
    if (fromPredefined) {
      return fromPredefined;
    }
    const savedSearches = await loadSavedSearches();
    const fromSaved = savedSearches.find((s) => s.id === defaultId);
    return fromSaved ?? null;
  }

  const savedSearches = await loadSavedSearches();
  return savedSearches.find((s) => s.isDefault) ?? null;
}

export const trackTriageSavedSearchApplied = createAppliedTracker({ page: 'triage' });
export const trackTriageSavedSearchAutoApply = createAutoApplyTracker({ page: 'triage' });
