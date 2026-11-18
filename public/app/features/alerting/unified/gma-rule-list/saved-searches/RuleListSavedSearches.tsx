import { SavedSearches } from '../../components/saved-searches/SavedSearches';
import { type UseGenericSavedSearchesResult } from '../../hooks/useGenericSavedSearches';
import { type RuleKind } from '../shared/ruleKind';

import { trackSavedSearchApplied } from './useRuleListSavedSearches';

interface RuleListSavedSearchesProps {
  kind: RuleKind;
  /** The applied query. */
  query: string;
  onApply: (query: string) => void;
  savedSearches: UseGenericSavedSearchesResult;
}

export function RuleListSavedSearches({ kind, query, onApply, savedSearches }: RuleListSavedSearchesProps) {
  return (
    <SavedSearches
      savedSearches={savedSearches.savedSearches}
      currentSearchQuery={query}
      onSave={savedSearches.saveSearch}
      onRename={savedSearches.renameSearch}
      onDelete={savedSearches.deleteSearch}
      onSetDefault={savedSearches.setDefaultSearch}
      isLoading={savedSearches.isLoading}
      onApply={(search) => {
        onApply(search.query);
        trackSavedSearchApplied(kind, search);
      }}
      getHref={(search) => `/alerting/rules/${kind}?search=${encodeURIComponent(search.query)}`}
    />
  );
}
