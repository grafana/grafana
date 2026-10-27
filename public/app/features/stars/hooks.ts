import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { type StarsList, useListStarsQuery } from 'app/api/clients/collections/v1alpha1';
import { setStarredItems, type StarredNavItem } from 'app/core/reducers/navBarTree';
import { starredFoldersEnabled } from 'app/features/browse-dashboards/utils/dashboards';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { dispatch } from 'app/store/store';

import { searchStarredResources } from './kindSearch';
import {
  getStarredKinds,
  getStarredKindsVersion,
  type StarredKind,
  starredNavEntry,
  subscribeStarredKinds,
} from './kinds';
import { findStarredNames, userStarsFieldSelector } from './utils';

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

type StarredNamesByKind = Array<{ kind: StarredKind; names: string[] }>;

/** Nav items for Grafana's own kinds, resolved through one dashboard search over the starred names. */
async function resolveGrafanaKinds(byKind: StarredNamesByKind, uids: string[]): Promise<StarredNavItem[]> {
  if (byKind.length === 0) {
    return [];
  }
  // The search matches the name union against every kind, so a cross-kind name collision can
  // return an item that was never starred as that kind — keep only kind-matching hits.
  const starredAs = new Map(byKind.map(({ kind, names }) => [kind.searchKind, { kind, names: new Set(names) }]));
  const names = new Set(byKind.flatMap(({ names }) => names));
  const response = await getGrafanaSearcher().search({
    // In the capped order, so the same stars always make the same request
    name: uids.filter((uid) => names.has(uid)),
    kind: byKind.map(({ kind }) => kind.searchKind),
  });

  const items: StarredNavItem[] = [];
  for (let i = 0; i < response.view.length; i++) {
    const row = response.view.get(i);
    const starred = starredAs.get(row.kind);
    if (!starred?.names.has(row.uid)) {
      continue;
    }
    // The search row carries the slugged url, which the nav keeps over the kind's plain one
    items.push({ ...starredNavEntry(starred.kind, row.uid), id: row.uid, title: row.name, url: row.url });
  }
  return items;
}

/** Nav items for a plugin kind, resolved through the kind's own search endpoint. */
async function resolvePluginKind(kind: StarredKind, names: string[]): Promise<StarredNavItem[]> {
  const resources = await searchStarredResources(kind, names);
  return resources.map((resource) => ({
    ...starredNavEntry(kind, resource.name),
    id: resource.name,
    title: resource.title,
  }));
}

/**
 * Resolves the user's stars to nav items. A plugin kind whose API is unavailable contributes
 * nothing rather than failing the sync; the dashboard search failing rejects, as it did before
 * plugin kinds existed.
 */
async function resolveStarredNavItems(stars: StarsList): Promise<{ uids: string[]; items: StarredNavItem[] }> {
  const kinds = getStarredKinds();
  const starredNames = (kind: StarredKind) => findStarredNames(stars, kind.group, kind.kind);
  // Dedupe so a name starred as several kinds can't occupy two cap slots or render twice
  const uids = [...new Set(kinds.flatMap(starredNames))].sort().slice(0, STARRED_NAV_CAP);
  const capped = new Set(uids);
  // Each query asks only about the part of the capped set starred as its kind
  const byKind: StarredNamesByKind = kinds
    .map((kind) => ({ kind, names: starredNames(kind).filter((name) => capped.has(name)) }))
    .filter(({ names }) => names.length > 0);

  const [grafanaItems, pluginItems] = await Promise.all([
    resolveGrafanaKinds(
      byKind.filter(({ kind }) => kind.origin === 'grafana'),
      uids
    ),
    Promise.all(
      byKind.filter(({ kind }) => kind.origin === 'plugin').map(({ kind, names }) => resolvePluginKind(kind, names))
    ),
  ]);
  return { uids, items: [...grafanaItems, ...pluginItems.flat()] };
}

/**
 * Sync starred items of every kind into the nav tree on mount and when the star set changes.
 * Replaces whatever the backend shipped in bootData (which is empty in dual-writer mode 5).
 */
export const useSyncStarredItemsInNav = () => {
  const { data: stars, isLoading, isError } = useListStarsQuery({ fieldSelector: userStarsFieldSelector() });
  // Read during render so the sync re-runs when the flag flips, since it decides which kinds are listed
  const foldersEnabled = starredFoldersEnabled();
  // A plugin registers its kinds as its module loads, which can be after the first sync
  const kindsVersion = useSyncExternalStore(subscribeStarredKinds, getStarredKindsVersion);

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

    resolveStarredNavItems(stars)
      .then(({ uids, items }) => {
        if (cancelled) {
          return;
        }
        dispatch(setStarredItems({ uids, items }));
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
  }, [starsKey, isLoading, foldersEnabled, kindsVersion]);

  return { isLoading: isLoading || !hasSynced, isError: isError || searchFailed };
};
