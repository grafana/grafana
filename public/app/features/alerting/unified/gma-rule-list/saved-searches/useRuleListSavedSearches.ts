import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import {
  type SavedSearchesConfig,
  type UseGenericSavedSearchesResult,
  createAppliedTracker,
  createAutoApplyTracker,
  createDefaultLoader,
  useGenericSavedSearches,
} from '../../hooks/useGenericSavedSearches';
import { type RuleKind } from '../shared/ruleKind';

// Module-level so the hook gets a stable config and loads once.
const CONFIGS: Record<RuleKind, SavedSearchesConfig> = {
  alert: { storageKey: 'alertRulesSavedSearches', trackingContext: { page: 'gma-alert' } },
  recording: { storageKey: 'recordingRulesSavedSearches', trackingContext: { page: 'gma-recording' } },
};

/** The page calls this once and hands the result to the toolbar control and the indicator, so both see each change. */
export function useRuleListSavedSearches(kind: RuleKind): UseGenericSavedSearchesResult {
  return useGenericSavedSearches(CONFIGS[kind]);
}

export function loadDefaultSavedSearch(kind: RuleKind): Promise<SavedSearch | null> {
  return createDefaultLoader(CONFIGS[kind])();
}

export function trackSavedSearchApplied(kind: RuleKind, search: SavedSearch): void {
  createAppliedTracker(CONFIGS[kind].trackingContext)(search);
}

export function trackDefaultSavedSearchApplied(kind: RuleKind): void {
  createAutoApplyTracker(CONFIGS[kind].trackingContext)();
}
