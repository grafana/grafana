import { createSelector } from '@reduxjs/toolkit';

import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type IconName, locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { collectionsAPIv1alpha1, type StarsList } from 'app/api/clients/collections/v1alpha1';
import { type StarredNavItem } from 'app/core/reducers/navBarTree';
import { discoveryResources, getAPIGroupDiscoveryList } from 'app/features/apiserver/discovery';
import { getFolderURL, starredFoldersEnabled } from 'app/features/browse-dashboards/utils/dashboards';
import { getIconForKind } from 'app/features/search/service/utils';
import { dispatch, store } from 'app/store/store';

import { appKindListPathResolver } from './appKindPages';

interface StarredKindBase {
  group: string;
  kind: string;
  /** The kind string search rows and nav leaves carry: `dashboard`, `folder`, or `group/Kind` for an app kind. */
  searchKind: string;
  /** Singular display name. */
  title(): string;
  icon: IconName;
  /** Starred lists group kinds by this rank, alphabetical within a rank: dashboards, folders, then app kinds. */
  sortWeight: number;
  url(name: string): string;
}

/** A kind whose titles come from its own search endpoint, which is addressed by served version and plural. */
export type KindSearchStarredKind = StarredKindBase & { source: 'kind-search'; version: string; resource: string };

/**
 * A kind Grafana can show starred objects of. The Stars resource stores names per API group and
 * kind; this describes how Grafana shows those names and where it finds their titles: dashboards
 * and folders through the dashboard search index, whose objects the browse views may move or
 * delete, and app plugin kinds through their own search endpoint.
 */
export type StarredKind = (StarredKindBase & { source: 'dashboard-search' }) | KindSearchStarredKind;

export function resolvesThroughKindSearch(kind: StarredKind): kind is KindSearchStarredKind {
  return kind.source === 'kind-search';
}

/** The starred names of one kind, as the Stars resource stores them. */
export interface StarredNames {
  group: string;
  kind: string;
  names: string[];
}

export type StarredNamesOfKind<K extends StarredKind = StarredKind> = { kind: K; names: string[] };

const DASHBOARD: StarredKind = {
  group: DASHBOARD_API_GROUP,
  kind: 'Dashboard',
  searchKind: 'dashboard',
  title: () => t('stars.kinds.dashboard', 'Dashboard'),
  icon: getIconForKind('dashboard'),
  sortWeight: 0,
  source: 'dashboard-search',
  url: (name) => locationUtil.assureBaseUrl(`/d/${name}`),
};

const FOLDER: StarredKind = {
  group: FOLDER_API_GROUP,
  kind: 'Folder',
  searchKind: 'folder',
  title: () => t('stars.kinds.folder', 'Folder'),
  icon: getIconForKind('folder'),
  sortWeight: 1,
  source: 'dashboard-search',
  url: getFolderURL,
};

const GRAFANA_KINDS: readonly StarredKind[] = [DASHBOARD, FOLDER];
const APP_KIND_FIRST_SORT_WEIGHT = GRAFANA_KINDS.length;
// One icon for every app kind until a kind can declare its own
const APP_KIND_ICON: IconName = 'cube';
const NO_APP_KINDS: readonly KindSearchStarredKind[] = [];

/** Whether the kind is one Grafana serves itself, so no app kind has to be discovered for it. */
export function isGrafanaKind(group: string, kind: string): boolean {
  return GRAFANA_KINDS.some((candidate) => candidate.group === group && candidate.kind === kind);
}

/** What discovery found for an app kind. Plain data, since the store caches it; the kind is derived from it. */
interface DiscoveredAppKind {
  group: string;
  kind: string;
  version: string;
  resource: string;
  listPath: string;
}

function appKind(
  { group, kind, version, resource, listPath }: DiscoveredAppKind,
  index: number
): KindSearchStarredKind {
  return {
    group,
    kind,
    searchKind: `${group}/${kind}`,
    // Kind names are singular nouns, which serves as the label until a kind can declare one
    title: () => kind,
    icon: APP_KIND_ICON,
    sortWeight: APP_KIND_FIRST_SORT_WEIGHT + index,
    source: 'kind-search',
    version,
    resource,
    url: (name) => locationUtil.assureBaseUrl(`${listPath}/${encodeURIComponent(name)}`),
  };
}

/** The app kinds behind a discovery result, in discovery order. */
export function appKindsFrom(discovered: readonly DiscoveredAppKind[] | undefined): readonly KindSearchStarredKind[] {
  return discovered?.map(appKind) ?? NO_APP_KINDS;
}

/**
 * The app kinds Grafana can show as starred: every namespaced kind API discovery lists for a
 * group other than Grafana's own, with a plugin page to link to.
 */
async function discoverAppKinds(): Promise<DiscoveredAppKind[]> {
  const resources = discoveryResources(await getAPIGroupDiscoveryList());
  const listPathFor = appKindListPathResolver();
  const seen = new Set<string>();
  const discovered: DiscoveredAppKind[] = [];
  for (const { responseKind, scope, resource } of resources) {
    const { group, kind, version } = responseKind;
    const key = `${group}/${kind}`;
    // Discovery lists a group's versions by preference, so a kind's first entry is its preferred version
    if (scope !== 'Namespaced' || isGrafanaKind(group, kind) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const listPath = listPathFor(resource);
    if (listPath) {
      discovered.push({ group, kind, version, resource, listPath });
    }
  }
  return discovered;
}

const appKindsAPI = collectionsAPIv1alpha1.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Discovered once per page load and kept for its whole life: what an instance serves only changes
     * with a deploy. A failed discovery is retried by the next caller, since RTK re-runs a rejected query.
     */
    discoverAppKinds: build.query<DiscoveredAppKind[], void>({
      queryFn: async () => {
        try {
          return { data: await discoverAppKinds() };
        } catch (error) {
          console.error('Failed to load the starred kinds', error);
          return { error };
        }
      },
      keepUnusedDataFor: Infinity,
    }),
  }),
});

export const { useDiscoverAppKindsQuery } = appKindsAPI;

// Memoized on the discovery result, so repeated lookups share one set of kind objects
const selectAppKinds = createSelector(appKindsAPI.endpoints.discoverAppKinds.select(), ({ data }) =>
  appKindsFrom(data)
);

/** The app kinds discovered so far; none until discovery has run, or before the store exists. */
function loadedAppKinds(): readonly KindSearchStarredKind[] {
  return store ? selectAppKinds(store.getState()) : NO_APP_KINDS;
}

/** Discovers the app kinds, or waits for the discovery already running. Resolves either way. */
export async function loadStarredKinds(): Promise<void> {
  await dispatch(appKindsAPI.endpoints.discoverAppKinds.initiate());
}

/** Whether the stars hold an object of a kind other than Grafana's own, which only discovery can describe. */
export function starsHoldAppKind(stars: StarsList | undefined): boolean {
  const resources = stars?.items?.[0]?.spec.resource ?? [];
  return resources.some(({ group, kind, names }) => names.length > 0 && !isGrafanaKind(group, kind));
}

/** Loads the app kinds when the stars hold an object of one; stars of Grafana's own kinds need no discovery. */
export async function loadStarredKindsFor(stars: StarsList | undefined): Promise<void> {
  if (starsHoldAppKind(stars)) {
    await loadStarredKinds();
  }
}

/** Only folders are gated: their stars show once the starred-folders flag is on. */
function isStarrable(kind: StarredKind, foldersEnabled = starredFoldersEnabled()): boolean {
  return kind !== FOLDER || foldersEnabled;
}

/** Among every kind Grafana can describe, its own and then the loaded app kinds. */
function findKnownKind(predicate: (kind: StarredKind) => boolean): StarredKind | undefined {
  return GRAFANA_KINDS.find(predicate) ?? loadedAppKinds().find(predicate);
}

/**
 * How a search row's or nav leaf's kind is shown, whether or not it can be starred right now;
 * undefined for kinds nobody can star, such as panels.
 */
export function findKind(searchKind: string): StarredKind | undefined {
  return findKnownKind((candidate) => candidate.searchKind === searchKind);
}

/** The kinds whose stars Grafana shows, in display order. */
export function starredKindsOf(
  foldersEnabled: boolean,
  appKinds: readonly KindSearchStarredKind[] = NO_APP_KINDS
): StarredKind[] {
  return [...GRAFANA_KINDS, ...appKinds].filter((kind) => isStarrable(kind, foldersEnabled));
}

export function getStarredKinds(): StarredKind[] {
  return starredKindsOf(starredFoldersEnabled(), loadedAppKinds());
}

export function findStarredKind(group: string, kind: string): StarredKind | undefined {
  const found = findKnownKind((candidate) => candidate.group === group && candidate.kind === kind);
  return found && isStarrable(found) ? found : undefined;
}

export function findStarredKindBySearchKind(searchKind: string): StarredKind | undefined {
  const found = findKind(searchKind);
  return found && isStarrable(found) ? found : undefined;
}

/**
 * Splits a star set by where its kinds' titles come from, in display order: Grafana's kinds
 * through the dashboard search index, app kinds through their own search. Stars of kinds Grafana
 * cannot show are left out.
 */
export function partitionStarred(resources: StarredNames[]): {
  indexed: StarredNamesOfKind[];
  app: Array<StarredNamesOfKind<KindSearchStarredKind>>;
} {
  const namesByKind = new Map(resources.map(({ group, kind, names }) => [`${group}/${kind}`, names]));
  const indexed: StarredNamesOfKind[] = [];
  const app: Array<StarredNamesOfKind<KindSearchStarredKind>> = [];
  for (const kind of getStarredKinds()) {
    const names = namesByKind.get(`${kind.group}/${kind.kind}`) ?? [];
    if (names.length === 0) {
      continue;
    }
    if (resolvesThroughKindSearch(kind)) {
      app.push({ kind, names });
    } else {
      indexed.push({ kind, names });
    }
  }
  return { indexed, app };
}

/** Whether starred lists need a kind icon per row: only when more than one kind can appear. */
export function starredKindsNeedIcons(): boolean {
  return getStarredKinds().length > 1;
}

/** Nav Starred entry (url, icon, sort rank, kind) for one starred object. */
export function starredNavEntry(starredKind: StarredKind, id: string): Omit<StarredNavItem, 'id' | 'title'> {
  return {
    url: starredKind.url(id),
    icon: starredKindsNeedIcons() ? starredKind.icon : undefined,
    sortWeight: starredKind.sortWeight,
    kind: starredKind.searchKind,
  };
}
