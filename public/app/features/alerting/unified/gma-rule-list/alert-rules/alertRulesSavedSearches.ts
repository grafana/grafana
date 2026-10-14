import {
  type UseGenericSavedSearchesResult,
  createDefaultLoader,
  useGenericSavedSearches,
} from '../../hooks/useGenericSavedSearches';
import { ALERT_SAVED_SEARCHES_STORAGE_KEY } from '../saved-searches/savedSearchesMigration';

export function useAlertRulesSavedSearches(): UseGenericSavedSearchesResult {
  return useGenericSavedSearches({ storageKey: ALERT_SAVED_SEARCHES_STORAGE_KEY });
}

export const loadDefaultAlertRulesSavedSearch = createDefaultLoader({ storageKey: ALERT_SAVED_SEARCHES_STORAGE_KEY });
