import { SavedSearches } from '../../components/saved-searches/SavedSearches';
import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { type UseGenericSavedSearchesResult, useGenericSavedSearches } from '../../hooks/useGenericSavedSearches';
import { legacyRuleListNameResolvers } from '../legacy-migration/nameResolvers';
import { useDroppedFiltersWarning } from '../legacy-migration/useDroppedFiltersWarning';
import { alertTokens } from '../rule-search/alertTokens';
import { parse } from '../rule-search/parser';
import { recordingTokens } from '../rule-search/recordingTokens';
import { serialize } from '../rule-search/serializer';
import { useRuleListSearchState } from '../rule-search/useRuleListSearchState';

import { type SavedSearchKind, applySavedSearch, storageKeyForKind } from './savedSearchesMigration';

/** One load of the kind's collection, shared by the toolbar control and the applied-search indicator. */
export function useRuleListSavedSearches(kind: SavedSearchKind): UseGenericSavedSearchesResult {
  return useGenericSavedSearches({ storageKey: storageKeyForKind(kind) });
}

/** Reads and applies the search through the URL, like the rest of the page. Migrates stored searches on apply. */
export function RuleListSavedSearches({
  kind,
  savedSearches,
}: {
  kind: SavedSearchKind;
  savedSearches: UseGenericSavedSearchesResult;
}) {
  const { filter, setFilter } = useRuleListSearchState(kind);
  const warnAboutDroppedFilters = useDroppedFiltersWarning();
  const registry = kind === 'alert' ? alertTokens : recordingTokens;

  const applyAndSetFilter = async (search: SavedSearch) => {
    const result = await applySavedSearch(
      search.query,
      legacyRuleListNameResolvers,
      (query) => parse(query, registry),
      (canonical) => savedSearches.updateSearch(search.id, canonical)
    );
    warnAboutDroppedFilters(result.droppedKeys);
    setFilter(result.filter);
  };

  return (
    <SavedSearches
      savedSearches={savedSearches.savedSearches}
      currentSearchQuery={serialize(filter)}
      onSave={savedSearches.saveSearch}
      onRename={savedSearches.renameSearch}
      onDelete={savedSearches.deleteSearch}
      onSetDefault={savedSearches.setDefaultSearch}
      isLoading={savedSearches.isLoading}
      onApply={applyAndSetFilter}
      getHref={(search) => `/alerting/rules/${kind}?search=${encodeURIComponent(search.query)}`}
    />
  );
}
