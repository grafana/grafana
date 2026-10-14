import {
  type UseGenericSavedSearchesResult,
  createDefaultLoader,
  useGenericSavedSearches,
} from '../../hooks/useGenericSavedSearches';
import { RECORDING_SAVED_SEARCHES_STORAGE_KEY } from '../saved-searches/savedSearchesMigration';

export function useRecordingRulesSavedSearches(): UseGenericSavedSearchesResult {
  return useGenericSavedSearches({ storageKey: RECORDING_SAVED_SEARCHES_STORAGE_KEY });
}

export const loadDefaultRecordingRulesSavedSearch = createDefaultLoader({
  storageKey: RECORDING_SAVED_SEARCHES_STORAGE_KEY,
});
