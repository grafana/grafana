import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState } from 'react';

import { getStarsSrv } from '@grafana/runtime';
import { useListStarsQuery } from 'app/api/clients/collections/v1alpha1';
import { setStarredItems, type StarredNavItem } from 'app/core/reducers/navBarTree';
import { starredFoldersEnabled } from 'app/features/browse-dashboards/utils/dashboards';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { dispatch } from 'app/store/store';

import { searchStarredResources } from './kindSearch';
import { loadStarredKinds, type StarredKind, starredKindsNeedIcons } from './kinds';
import { findStarredNames, userStarsFieldSelector } from './utils';

type StarItemArgs = {
  id: string;
  /** Title of the item - this is displayed in the nav */
  title: string;
};

/** Star or unstar an item; the same path plugins take through getStarsSrv(). */
export const useStarItem = (group: string, kind: string) => {
  return async ({ id, title }: StarItemArgs, newStarredState: boolean) => {
    const ref = { group, kind, id, title };
    try {
      await (newStarredState ? getStarsSrv().star(ref) : getStarsSrv().unstar(ref));
    } catch {
      // Server rejected the change — the nav stays as-is rather than showing state that didn't persist
    }
  };
};

/**
 * Get starred items from the app platform API
 */
export const useStarredItems = (group: string, kind: string, options?: { skip?: boolean }) => {
  const skip = options?.skip ?? false;
  const response = useListStarsQuery(skip ? skipToken : { fieldSelector: userStarsFieldSelector() });

  const starredItems = useMemo(() => {
    const { data, isLoading, isUninitialized } = response;

    // If query hasn't been initiated yet or is still loading, return undefined to show loading state
    if (isUninitialized || isLoading) {
      return undefined;
    }

    // If query completed but no data, return empty array
    if (!data) {
      return [];
    }

    return findStarredNames(data, group, kind);
  }, [response, group, kind]);

  return {
    ...response,
    data: starredItems,
    // Ensure isLoading is true when data is undefined (still loading or uninitialized)
    isLoading: starredItems === undefined ? true : response.isLoading,
  };
};

// Matches the backend cap on starred nav children in bootData (buildStarredItemsNavLinks)
const STARRED_NAV_CAP = 50;

/** The starred names of each kind, in the order the kinds are listed. */
type StarredNamesByKind = Array<{ kind: StarredKind; names: string[] }>;

/**
 * Resolves starred names to nav items: Grafana's own kinds through one dashboard search, each
 * plugin kind through its own search endpoint. A plugin kind whose API is unavailable (plugin
 * disabled, apiserver down) contributes nothing rather than failing the sync; the dashboard
 * search failing rejects, as it did before plugin kinds existed.
 */
async function resolveStarredNavItems(byKind: StarredNamesByKind, names: string[]): Promise<StarredNavItem[]> {
  const showIcons = starredKindsNeedIcons();
  const searchKinds = byKind.filter(({ kind, names }) => kind.source === 'dashboard-search' && names.length > 0);
  const pluginKinds = byKind.filter(({ kind, names }) => kind.source === 'kind-search' && names.length > 0);
  // `names` is the capped, deduped union; each query asks only about the part starred as its kinds
  const namesStarredAs = (entries: StarredNamesByKind) => {
    const starred = new Set(entries.flatMap(({ names }) => names));
    return names.filter((name) => starred.has(name));
  };
  const searchNames = namesStarredAs(searchKinds);

  const [response, ...resolvedPluginKinds] = await Promise.all([
    searchNames.length > 0
      ? getGrafanaSearcher().search({ name: searchNames, kind: searchKinds.map(({ kind }) => kind.searchKind) })
      : Promise.resolve(undefined),
    ...pluginKinds.map((entry) =>
      searchStarredResources(entry.kind, namesStarredAs([entry])).catch((err: unknown) => {
        console.error(`Failed to resolve starred ${entry.kind.group}/${entry.kind.kind}`, err);
        return [];
      })
    ),
  ]);

  const items: StarredNavItem[] = [];
  // The search matches the name union against every kind, so a cross-kind name collision can
  // return an item that was never starred as that kind — keep only kind-matching hits.
  const starredNamesBySearchKind = new Map(searchKinds.map(({ kind, names }) => [kind.searchKind, new Set(names)]));
  for (let i = 0; response && i < response.view.length; i++) {
    const row = response.view.get(i);
    const kind = searchKinds.find(({ kind }) => kind.searchKind === row.kind)?.kind;
    if (!kind || !starredNamesBySearchKind.get(row.kind)?.has(row.uid)) {
      continue;
    }
    items.push({
      id: row.uid,
      title: row.name,
      url: row.url,
      icon: showIcons ? kind.icon : undefined,
      sortWeight: kind.sortWeight,
    });
  }
  pluginKinds.forEach(({ kind }, index) => {
    for (const resource of resolvedPluginKinds[index]) {
      items.push({
        id: resource.name,
        title: resource.title,
        url: kind.url(resource.name),
        icon: kind.icon,
        sortWeight: kind.sortWeight,
      });
    }
  });
  return items;
}

/**
 * Sync starred items of every kind into the nav tree on mount and when the star set changes.
 * Replaces whatever the backend shipped in bootData (which is empty in dual-writer mode 5).
 */
export const useSyncStarredItemsInNav = () => {
  const { data: stars, isLoading, isError } = useListStarsQuery({ fieldSelector: userStarsFieldSelector() });
  // Read during render so the sync re-runs when the flag flips, since it decides which kinds are listed
  const foldersEnabled = starredFoldersEnabled();

  // Initialized from the stars query so a remount with a warm RTK cache doesn't
  // flash a loading state — the nav tree is already correct from the prior sync
  const [hasSynced, setHasSynced] = useState(!isLoading);
  const [searchFailed, setSearchFailed] = useState(false);

  // Stable identity so the effect doesn't re-fire when the response ref changes but its stars are identical
  const starsKey = useMemo(
    () =>
      stars &&
      (stars.items?.[0]?.spec.resource ?? [])
        .map((resource) => `${resource.group}/${resource.kind}:${[...resource.names].sort().join(',')}`)
        .sort()
        .join(';'),
    [stars]
  );

  useEffect(() => {
    if (isLoading || starsKey === undefined || !stars) {
      return;
    }

    let cancelled = false;

    loadStarredKinds()
      .then(async (kinds) => {
        const byKind: StarredNamesByKind = kinds.map((kind) => ({
          kind,
          names: findStarredNames(stars, kind.group, kind.kind),
        }));
        // Dedupe so a name starred as several kinds can't occupy two cap slots or render twice
        const names = [...new Set(byKind.flatMap(({ names }) => names))].sort().slice(0, STARRED_NAV_CAP);
        const items = names.length === 0 ? [] : await resolveStarredNavItems(byKind, names);
        if (cancelled) {
          return;
        }
        dispatch(setStarredItems({ uids: names, items }));
        setHasSynced(true);
        setSearchFailed(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        console.error('Failed to sync starred items to nav', err);
        // Resolve the loading state rather than showing it forever
        setHasSynced(true);
        setSearchFailed(true);
      });

    return () => {
      cancelled = true;
    };
    // `stars` only changes in step with starsKey, which is the identity the sync keys on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starsKey, isLoading, foldersEnabled]);

  return { isLoading: isLoading || !hasSynced, isError: isError || searchFailed };
};
