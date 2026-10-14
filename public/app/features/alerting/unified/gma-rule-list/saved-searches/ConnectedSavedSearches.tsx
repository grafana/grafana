import { SavedSearches } from '../../components/saved-searches/SavedSearches';
import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { type UseGenericSavedSearchesResult } from '../../hooks/useGenericSavedSearches';
import { type NameResolvers } from '../legacy-migration/migrationResolve';
import { type Criteria } from '../rule-search/criteria';

import { type SavedSearchKind, applySavedSearch } from './savedSearchesMigration';

interface ConnectedSavedSearchesProps {
  /** The page's own saved-search collection hook (Alert's or Recording's) - called here so its
   * storage read only starts once the caller has decided it's safe to mount this (see
   * useLegacySavedSearchesCopied). */
  useSavedSearches: () => UseGenericSavedSearchesResult;
  kind: SavedSearchKind;
  query: string;
  parseForKind: (query: string) => Criteria;
  resolvers: NameResolvers;
  setCriteria: (criteria: Criteria) => void;
  getHref: (search: SavedSearch) => string;
}

/**
 * Wires one page's saved-search hook into the generic SavedSearches UI, including applying a
 * search that still needs query migration: the migrated form is persisted back onto that same
 * entry via updateSearch, so re-applying it later reads the canonical query directly.
 */
export function ConnectedSavedSearches({
  useSavedSearches,
  kind,
  query,
  parseForKind,
  resolvers,
  setCriteria,
  getHref,
}: ConnectedSavedSearchesProps) {
  const savedSearches = useSavedSearches();

  const onApply = async (search: SavedSearch) => {
    const { criteria } = await applySavedSearch(search.query, kind, resolvers, parseForKind, (canonicalQuery) =>
      savedSearches.updateSearch(search.id, canonicalQuery)
    );
    setCriteria(criteria);
  };

  return (
    <SavedSearches
      savedSearches={savedSearches.savedSearches}
      currentSearchQuery={query}
      onSave={savedSearches.saveSearch}
      onRename={savedSearches.renameSearch}
      onDelete={savedSearches.deleteSearch}
      onSetDefault={savedSearches.setDefaultSearch}
      isLoading={savedSearches.isLoading}
      onApply={onApply}
      getHref={getHref}
    />
  );
}
