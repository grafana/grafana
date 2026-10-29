import { type ComponentType, use, useEffect } from 'react';

import { locationService } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';

import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { createAutoApplyTracker, createStorageLoader } from '../../hooks/useGenericSavedSearches';
import { legacyRuleListNameResolvers } from '../legacy-migration/nameResolvers';
import { useDroppedFiltersWarning } from '../legacy-migration/useDroppedFiltersWarning';
import { type RuleKind } from '../shared/ruleKind';
import { alertTokens } from '../token-search/alertTokens';
import { parse } from '../token-search/parser';
import { recordingTokens } from '../token-search/recordingTokens';
import { searchParamsForFilter } from '../token-search/useRuleListSearchState';

import { applySavedSearch, copyLegacySavedSearchesOnce, storageKeyForKind } from './savedSearchesMigration';

const trackDefaultSearchApplied = createAutoApplyTracker();

// One setup per mounted page. It must outlive React's retries after suspending, so it lives outside the component.
const pendingSetups = new Map<RuleKind, Promise<string[]>>();

/**
 * Renders `Page` only once the legacy copy has run and, with no `search` parameter in the URL, the default saved search
 * is in the URL. An empty `search=` is a deliberate unfiltered list and keeps it. The page never knows a saved search
 * was applied and never requests unfiltered results. Suspends to the route's boundary.
 */
export function withSavedSearchesSetup<P extends {}>(kind: RuleKind, Page: ComponentType<P>): ComponentType<P> {
  function SavedSearchesSetupProxy(props: P) {
    useSavedSearchesSetup(kind);
    return <Page {...props} />;
  }
  return SavedSearchesSetupProxy;
}

function useSavedSearchesSetup(kind: RuleKind): void {
  let setupPromise = pendingSetups.get(kind);
  if (!setupPromise) {
    setupPromise = setUpSavedSearches(kind);
    pendingSetups.set(kind, setupPromise);
  }
  const droppedKeys = use(setupPromise);

  // Cleared on unmount so the next visit loads fresh and decides on the default again.
  useEffect(
    () => () => {
      if (pendingSetups.get(kind) === setupPromise) {
        pendingSetups.delete(kind);
      }
    },
    [kind, setupPromise]
  );

  const warnAboutDroppedFilters = useDroppedFiltersWarning();
  useEffect(() => {
    warnAboutDroppedFilters(droppedKeys);
  }, [droppedKeys, warnAboutDroppedFilters]);
}

/** Never rejects. Resolves to the filter names dropped while migrating the default. */
async function setUpSavedSearches(kind: RuleKind): Promise<string[]> {
  const params = new URLSearchParams(locationService.getLocation().search);
  const applyDefault = !params.has('search');

  try {
    await copyLegacySavedSearchesOnce(legacyRuleListNameResolvers);
  } catch {
    // The copy retries on the next visit.
  }

  const storageKey = storageKeyForKind(kind);
  let savedSearches: SavedSearch[];
  try {
    savedSearches = await createStorageLoader({ storageKey })();
  } catch {
    // The saved-searches control reports the load failure.
    return [];
  }

  const defaultSearch = applyDefault ? savedSearches.find((search) => search.isDefault) : undefined;
  if (!defaultSearch) {
    return [];
  }

  trackDefaultSearchApplied();
  const registry = kind === 'alert' ? alertTokens : recordingTokens;
  const { filter, droppedKeys } = await applySavedSearch(
    defaultSearch.query,
    legacyRuleListNameResolvers,
    (query) => parse(query, registry),
    (canonical) => {
      savedSearches = savedSearches.map((search) =>
        search.id === defaultSearch.id ? { ...search, query: canonical } : search
      );
      return new UserStorage('alerting').setItem(storageKey, JSON.stringify(savedSearches));
    }
  );
  // Replacing keeps the bare URL out of the history, so Back does not land on an unfiltered list.
  locationService.partial(searchParamsForFilter(filter, params.get('view'), false), true);

  return droppedKeys;
}
