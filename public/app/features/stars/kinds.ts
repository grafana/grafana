import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type IconName, locationUtil, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type StarsList } from 'app/api/clients/collections/v1alpha1';
import {
  discoveryResources,
  getAPIGroupDiscoveryList,
  type GroupDiscoveryResource,
} from 'app/features/apiserver/discovery';
import { getFolderURL, starredFoldersEnabled } from 'app/features/browse-dashboards/utils/dashboards';
import { store } from 'app/store/store';

interface StarredKindBase {
  group: string;
  kind: string;
  /** The kind string search rows and nav leaves carry: `dashboard`, `folder`, or `group/Kind` for an app kind. */
  searchKind: string;
  /** Singular display name. */
  title: string;
  icon: IconName;
  /** Starred lists group kinds by this rank, alphabetical within a rank: dashboards, folders, then app kinds. */
  sortWeight: number;
  url(name: string): string;
}

/** A kind whose titles come from its own search endpoint, which is addressed by served version and plural. */
export type KindSearchStarredKind = StarredKindBase & { source: 'kind-search'; version: string; resource: string };

/**
 * A kind whose starred objects Grafana shows. The Stars resource stores names per API group and
 * kind; this describes how Grafana shows those names and where it finds their titles: dashboards
 * and folders through the dashboard search index, whose objects the browse views may move or
 * delete, and app plugin kinds through their own search endpoint.
 */
export type StarredKind = (StarredKindBase & { source: 'dashboard-search' }) | KindSearchStarredKind;

export function resolvesThroughKindSearch(kind: StarredKind): kind is KindSearchStarredKind {
  return kind.source === 'kind-search';
}

const APP_KIND_FIRST_SORT_WEIGHT = 2;
// One icon for every app kind until a kind can declare its own
const APP_KIND_ICON: IconName = 'cube';

/** Nav Starred entry (url + icon + sort rank + kind) for one starred object. */
export interface StarredNavEntry {
  url: string;
  icon?: IconName;
  sortWeight: number;
  kind: string;
}

function dashboardKind(): StarredKind {
  return {
    group: DASHBOARD_API_GROUP,
    kind: 'Dashboard',
    searchKind: 'dashboard',
    title: t('stars.kinds.dashboard', 'Dashboard'),
    icon: 'apps',
    sortWeight: 0,
    source: 'dashboard-search',
    url: (name) => locationUtil.assureBaseUrl(`/d/${name}`),
  };
}

function folderKind(): StarredKind {
  return {
    group: FOLDER_API_GROUP,
    kind: 'Folder',
    searchKind: 'folder',
    title: t('stars.kinds.folder', 'Folder'),
    icon: 'folder',
    sortWeight: 1,
    source: 'dashboard-search',
    url: getFolderURL,
  };
}

const GRAFANA_KINDS = new Set([`${DASHBOARD_API_GROUP}/Dashboard`, `${FOLDER_API_GROUP}/Folder`]);

/** Whether the kind is one Grafana serves itself, so no app kind has to be discovered for it. */
export function isGrafanaKind(group: string, kind: string): boolean {
  return GRAFANA_KINDS.has(`${group}/${kind}`);
}

/** Paths of the app plugin pages in the nav tree, without the app sub url, query or trailing slash. */
function pluginPagePaths(): string[] {
  const paths = new Set<string>();
  const visit = (items: NavModelItem[]) => {
    for (const item of items) {
      const path = item.url && locationUtil.stripBaseFromUrl(item.url).split(/[?#]/)[0].replace(/\/$/, '');
      if (path?.startsWith('/a/')) {
        paths.add(path);
      }
      if (item.children) {
        visit(item.children);
      }
    }
  };
  visit(store.getState().navBarTree);
  return [...paths];
}

/**
 * Interim, until a kind can declare its page: the app platform manifest carries no UI route yet,
 * so the list page is taken to be the plugin page whose path ends in the kind's plural, e.g.
 * `/a/grafana-irm-app/incidents` for `incidents`, and an object's page is that path plus its
 * name. A kind with no such page, or with several, is not shown. Replace with the declared path
 * (manifest `ui.path`) once it exists.
 */
function appKindListPath(resource: GroupDiscoveryResource, pluginPages: string[]): string | undefined {
  const matches = pluginPages.filter((path) => path.endsWith(`/${resource.resource}`));
  return matches.length === 1 ? matches[0] : undefined;
}

function appKind(resource: GroupDiscoveryResource, listPath: string, sortWeight: number): KindSearchStarredKind {
  const { group, kind, version } = resource.responseKind;
  return {
    group,
    kind,
    searchKind: `${group}/${kind}`,
    // Kind names are singular nouns, which serves as the label until a kind can declare one
    title: kind,
    icon: APP_KIND_ICON,
    sortWeight,
    source: 'kind-search',
    version,
    resource: resource.resource,
    url: (name) => locationUtil.assureBaseUrl(`${listPath}/${encodeURIComponent(name)}`),
  };
}

async function discoverAppKinds(): Promise<KindSearchStarredKind[]> {
  const resources = discoveryResources(await getAPIGroupDiscoveryList());
  const pages = pluginPagePaths();
  const seen = new Set<string>();
  const kinds: KindSearchStarredKind[] = [];
  for (const resource of resources) {
    const key = `${resource.responseKind.group}/${resource.responseKind.kind}`;
    // Discovery lists a group's versions by preference, so a kind's first entry is its preferred version
    if (resource.scope !== 'Namespaced' || GRAFANA_KINDS.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const listPath = appKindListPath(resource, pages);
    if (listPath) {
      kinds.push(appKind(resource, listPath, APP_KIND_FIRST_SORT_WEIGHT + kinds.length));
    }
  }
  return kinds;
}

let appKinds: KindSearchStarredKind[] = [];
let appKindsLoad: Promise<void> | undefined;

/**
 * Finds the app kinds Grafana can show as starred: every namespaced kind API discovery lists for
 * a group other than Grafana's own, with a plugin page to link to. Loaded once per page load; a
 * failed load is retried by the next caller. Rows of these kinds only exist after a caller
 * awaited this, so the synchronous readers below see them.
 */
export function loadStarredKinds(): Promise<void> {
  if (!appKindsLoad) {
    const load = discoverAppKinds().then(
      (kinds) => {
        appKinds = kinds;
      },
      (err: unknown) => {
        console.error('Failed to load the starred kinds', err);
        if (appKindsLoad === load) {
          appKindsLoad = undefined;
        }
      }
    );
    appKindsLoad = load;
  }
  return appKindsLoad;
}

/** Loads the app kinds when the stars hold an object of one; stars of Grafana's own kinds need no discovery. */
export async function loadStarredKindsFor(stars: StarsList | undefined): Promise<void> {
  const resources = stars?.items?.[0]?.spec.resource ?? [];
  if (resources.some(({ group, kind, names }) => names.length > 0 && !GRAFANA_KINDS.has(`${group}/${kind}`))) {
    await loadStarredKinds();
  }
}

/** Forgets the loaded app kinds, so the next load discovers again. Tests only. */
export function resetStarredKinds(): void {
  appKinds = [];
  appKindsLoad = undefined;
}

/** Grafana's own kinds, then the app kinds loaded so far. */
export function getStarredKinds(): StarredKind[] {
  const kinds = [dashboardKind()];
  if (starredFoldersEnabled()) {
    kinds.push(folderKind());
  }
  return [...kinds, ...appKinds];
}

export function findStarredKind(group: string, kind: string): StarredKind | undefined {
  return getStarredKinds().find((candidate) => candidate.group === group && candidate.kind === kind);
}

/** The kind behind a search row's kind string; undefined for rows nobody can star, such as panels. */
export function findStarredKindBySearchKind(searchKind: string): StarredKind | undefined {
  return getStarredKinds().find((candidate) => candidate.searchKind === searchKind);
}

/** Whether starred lists need a kind icon per row: only when more than one kind can appear. */
export function starredKindsNeedIcons(): boolean {
  return getStarredKinds().length > 1;
}

export function starredNavEntry(starredKind: StarredKind, id: string): StarredNavEntry {
  return {
    url: starredKind.url(id),
    icon: starredKindsNeedIcons() ? starredKind.icon : undefined,
    sortWeight: starredKind.sortWeight,
    kind: starredKind.searchKind,
  };
}
