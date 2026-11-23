import { createSelector } from '@reduxjs/toolkit';

import { type IconName } from '@grafana/data';
import { type KindInfo } from '@grafana/runtime/unstable';
import { collectionsAPIv1alpha1, type StarsList } from 'app/api/clients/collections/v1alpha1';
import { CORE_KINDS, findKind } from 'app/core/kinds/coreKinds';
import { discoveryResources, getAPIGroupDiscoveryList } from 'app/features/apiserver/discovery';
import { dispatch, store } from 'app/store/store';

import { appKindListPathResolver } from './appKindPages';

/**
 * What the starred views read of any kind, under the names the shared kind description gives them. A core kind
 * brings them in its row of the kind table; an app kind fills them from discovery.
 */
interface StarredKindBase extends Pick<KindInfo, 'group' | 'kind' | 'resource' | 'getLabel' | 'icon'> {
  /**
   * The kind string search rows and nav leaves carry. Optional on a core kind, required here. `dashboard` and
   * `folder` are the dashboard index's own spelling, which it filters on and labels its rows with. An app kind's
   * hits are labelled by the client, as `group/Kind`: kind names repeat across groups, and two kinds sharing a
   * string would share one entry.
   */
  searchKind: string;
}

/**
 * A kind whose titles come from its own search endpoint, which is addressed by served version and plural. Its
 * search hits carry no link, so the kind needs a page to build one from the object's name.
 */
export type KindSearchStarredKind = StarredKindBase & {
  source: 'kind-search';
  version: string;
  getRoute: NonNullable<KindInfo['getRoute']>;
};

/** A kind whose titles come from the dashboard search index: dashboards and folders. */
export type DashboardSearchStarredKind = StarredKindBase & { source: 'dashboard-search' };

/**
 * A kind Grafana can show starred objects of. The Stars resource stores names per API group and
 * kind; this describes how Grafana shows those names and where it finds their titles: dashboards
 * and folders through the dashboard search index, whose objects the browse views may move or
 * delete, and app plugin kinds through their own search endpoint.
 */
export type StarredKind = DashboardSearchStarredKind | KindSearchStarredKind;

function resolvesThroughKindSearch(kind: StarredKind): kind is KindSearchStarredKind {
  return kind.source === 'kind-search';
}

/** The starred names of one kind, as the Stars resource stores them. */
export interface StarredNames {
  group: string;
  kind: string;
  names: string[];
}

export type StarredNamesOfKind<K extends StarredKind = StarredKind> = { kind: K; names: string[] };

const DASHBOARD: StarredKind = { ...CORE_KINDS.dashboard, source: 'dashboard-search' };

const FOLDER: StarredKind = { ...CORE_KINDS.folder, source: 'dashboard-search' };

// In display order: the nav lists starred dashboards before starred folders
const GRAFANA_KINDS: readonly StarredKind[] = [DASHBOARD, FOLDER];
// TODO: Temporary. One icon for every app kind, until a kind can declare its own
const APP_KIND_ICON: IconName = 'cube';

/** What discovery found for an app kind. Plain data, since the store caches it; the kind is derived from it. */
interface DiscoveredAppKind {
  group: string;
  kind: string;
  version: string;
  resource: string;
  listPath: string;
}

function appKind({ group, kind, version, resource, listPath }: DiscoveredAppKind): KindSearchStarredKind {
  return {
    group,
    kind,
    resource,
    searchKind: `${group}/${kind}`,
    // TODO: Temporary. The kind name stands in for a label, until a kind can declare one
    getLabel: () => kind,
    icon: APP_KIND_ICON,
    // Without the app sub path, as a core kind's route is
    getRoute: (name) => `${listPath}/${encodeURIComponent(name)}`,
    source: 'kind-search',
    version,
  };
}

/**
 * The app kinds Grafana can show as starred: every namespaced kind API discovery lists that is not a core
 * kind, with a plugin page to link to.
 */
async function discoverAppKinds(): Promise<DiscoveredAppKind[]> {
  const resources = discoveryResources(await getAPIGroupDiscoveryList());
  const listPathFor = appKindListPathResolver();
  const seen = new Set<string>();
  const discovered: DiscoveredAppKind[] = [];
  for (const { responseKind, scope, resource } of resources) {
    const { group, kind, version } = responseKind;
    const key = `${group}/${kind}`;
    // Discovery lists a group's versions by preference, so a kind's first entry is its preferred version. A core
    // kind is described by the kind table, whatever a plugin names its pages
    if (scope !== 'Namespaced' || findKind(group, kind) || seen.has(key)) {
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

/**
 * The kinds whose stars Grafana shows, in display order: its own, then the app kinds in discovery order.
 * Memoized on the discovery result, so repeated lookups share one list of kind objects.
 */
export const selectStarredKinds = createSelector(
  appKindsAPI.endpoints.discoverAppKinds.select(),
  ({ data }): readonly StarredKind[] => (data ? [...GRAFANA_KINDS, ...data.map(appKind)] : GRAFANA_KINDS)
);

/** Grafana's own kinds, then the app kinds discovered so far; only Grafana's before the store exists. */
export function getStarredKinds(): readonly StarredKind[] {
  return store ? selectStarredKinds(store.getState()) : GRAFANA_KINDS;
}

/** Whether the stars hold an object of a kind other than Grafana's own, which only discovery can describe. */
export function starsHoldAppKind(stars: StarsList | undefined): boolean {
  const resources = stars?.items?.[0]?.spec.resource ?? [];
  return resources.some(({ group, kind, names }) => names.length > 0 && !findKind(group, kind));
}

/**
 * Discovers the app kinds when the stars hold an object of one, or waits for the discovery already running;
 * stars of Grafana's own kinds need no discovery. Resolves either way.
 */
export async function loadStarredKindsFor(stars: StarsList | undefined): Promise<void> {
  if (starsHoldAppKind(stars)) {
    // Not subscribed: the endpoint keeps its result for the page's life, and a subscription would never be released
    await dispatch(appKindsAPI.endpoints.discoverAppKinds.initiate(undefined, { subscribe: false }));
  }
}

/** The kind behind a search row's or nav leaf's kind string; undefined for kinds nobody can star, such as panels. */
export function findStarredKindBySearchKind(searchKind: string): StarredKind | undefined {
  return getStarredKinds().find((candidate) => candidate.searchKind === searchKind);
}

/**
 * TODO: Switch to the global search when it is enabled. It finds the titles of every kind in one
 * search, so this split goes, and with it a kind's `version`.
 *
 * Splits a star set by where its kinds' titles come from, in display order: Grafana's kinds
 * through the dashboard search index, app kinds through their own search. Stars of kinds Grafana
 * cannot show are left out.
 */
export function partitionStarred(resources: StarredNames[]): {
  indexed: Array<StarredNamesOfKind<DashboardSearchStarredKind>>;
  app: Array<StarredNamesOfKind<KindSearchStarredKind>>;
} {
  const namesByKind = new Map(resources.map(({ group, kind, names }) => [`${group}/${kind}`, names]));
  const indexed: Array<StarredNamesOfKind<DashboardSearchStarredKind>> = [];
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
