import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type IconName, locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type StarredKindRegistration } from '@grafana/runtime';
import { getFolderURL, starredFoldersEnabled } from 'app/features/browse-dashboards/utils/dashboards';

/**
 * A kind whose starred objects Grafana shows. The Stars resource stores names per API group and
 * kind; this describes how Grafana shows those names and where it finds their titles. Dashboards
 * and folders are built in; every other kind is registered at runtime, app plugins doing so
 * through getStarsSrv().
 */
export interface StarredKind {
  group: string;
  kind: string;
  /** The kind string search rows and nav leaves carry: `dashboard`, `folder`, or `group/Kind` for a registered kind. */
  searchKind: string;
  /** Singular display name. */
  title: string;
  icon: IconName;
  /** Starred lists group kinds by this rank, alphabetical within a rank: dashboards, folders, then registered kinds. */
  sortWeight: number;
  /**
   * Where titles and folders come from: the dashboard search index, which holds dashboards and
   * folders and whose objects the browse views may move or delete, or the kind's own search
   * endpoint.
   */
  source: 'dashboard-search' | 'kind-search';
  url(name: string): string;
}

const REGISTERED_KIND_FIRST_SORT_WEIGHT = 2;
const DEFAULT_REGISTERED_KIND_ICON: IconName = 'cube';

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

function registeredKind(registration: StarredKindRegistration, sortWeight: number): StarredKind {
  // An object's page is the list page plus its name, the way app platform UIs route
  const listUrl = registration.listUrl.replace(/\/$/, '');
  return {
    group: registration.group,
    kind: registration.kind,
    searchKind: `${registration.group}/${registration.kind}`,
    title: registration.title,
    icon: registration.icon ?? DEFAULT_REGISTERED_KIND_ICON,
    sortWeight,
    source: 'kind-search',
    url: (name) => locationUtil.assureBaseUrl(`${listUrl}/${encodeURIComponent(name)}`),
  };
}

// In registration order; registering a kind again replaces its earlier registration
const registrations = new Map<string, StarredKindRegistration>();
let registeredKinds: StarredKind[] = [];
let version = 0;
const listeners = new Set<() => void>();

function rebuildRegisteredKinds() {
  registeredKinds = [...registrations.values()].map((registration, index) =>
    registeredKind(registration, REGISTERED_KIND_FIRST_SORT_WEIGHT + index)
  );
  version++;
  listeners.forEach((listener) => listener());
}

/** Registers a kind so starred lists show its objects; returns the unregister function. */
export function registerStarredKind(registration: StarredKindRegistration): () => void {
  const key = `${registration.group}/${registration.kind}`;
  registrations.set(key, registration);
  rebuildRegisteredKinds();
  return () => {
    if (registrations.get(key) === registration) {
      registrations.delete(key);
      rebuildRegisteredKinds();
    }
  };
}

/** Changes whenever a kind is registered or unregistered, for readers that have to re-run then. */
export function getStarredKindsVersion(): number {
  return version;
}

export function subscribeStarredKinds(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Grafana's own kinds, then the registered ones. */
export function getStarredKinds(): StarredKind[] {
  const kinds = [dashboardKind()];
  if (starredFoldersEnabled()) {
    kinds.push(folderKind());
  }
  return [...kinds, ...registeredKinds];
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
