import { useEffect, useRef } from 'react';

import { SavedSearches } from '../../components/saved-searches/SavedSearches';
import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { type UseGenericSavedSearchesResult, createAutoApplyTracker } from '../../hooks/useGenericSavedSearches';
import { type NameResolvers } from '../legacy-migration/migrationResolve';
import { useDroppedFiltersWarning } from '../legacy-migration/useDroppedFiltersWarning';
import { type Criteria } from '../rule-search/criteria';

import { type SavedSearchKind, applySavedSearch } from './savedSearchesMigration';

const trackDefaultSearchApplied = createAutoApplyTracker();

interface ConnectedSavedSearchesProps {
  /** The page's own saved-search collection hook (Alert's or Recording's) - called here so its
   * storage read only starts once the caller has decided it's safe to mount this (see
   * useLegacySavedSearchesCopied). */
  useSavedSearches: () => UseGenericSavedSearchesResult;
  kind: SavedSearchKind;
  query: string;
  parseForKind: (query: string) => Criteria;
  resolvers: NameResolvers;
  setCriteria: (criteria: Criteria, options?: { replace?: boolean }) => void;
  getHref: (search: SavedSearch) => string;
  /** Apply the collection's default search once it has loaded, for a page opened with no query. */
  applyDefault: boolean;
  /** Called once the default search has been applied, or there is none to apply. */
  onDefaultSettled: () => void;
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
  applyDefault,
  onDefaultSettled,
}: ConnectedSavedSearchesProps) {
  const savedSearches = useSavedSearches();
  const warnAboutDroppedFilters = useDroppedFiltersWarning();
  const defaultHandledRef = useRef(false);

  const applyAndSetCriteria = async (search: SavedSearch, options?: { replace?: boolean }) => {
    const { criteria, droppedKeys } = await applySavedSearch(search.query, kind, resolvers, parseForKind, (canonical) =>
      savedSearches.updateSearch(search.id, canonical)
    );
    warnAboutDroppedFilters(droppedKeys);
    setCriteria(criteria, options);
  };

  useEffect(() => {
    if (!applyDefault || savedSearches.isLoading || defaultHandledRef.current) {
      return;
    }
    defaultHandledRef.current = true;

    const defaultSearch = savedSearches.savedSearches.find((search) => search.isDefault);
    if (!defaultSearch) {
      onDefaultSettled();
      return;
    }
    trackDefaultSearchApplied();
    // Replacing keeps the bare URL out of the history, so Back does not land on an unfiltered list.
    applyAndSetCriteria(defaultSearch, { replace: true }).finally(onDefaultSettled);
    // Runs once, when the collection finishes loading; later edits to it must not re-apply the default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyDefault, savedSearches.isLoading]);

  return (
    <SavedSearches
      savedSearches={savedSearches.savedSearches}
      currentSearchQuery={query}
      onSave={savedSearches.saveSearch}
      onRename={savedSearches.renameSearch}
      onDelete={savedSearches.deleteSearch}
      onSetDefault={savedSearches.setDefaultSearch}
      isLoading={savedSearches.isLoading}
      onApply={(search) => applyAndSetCriteria(search)}
      getHref={getHref}
    />
  );
}
