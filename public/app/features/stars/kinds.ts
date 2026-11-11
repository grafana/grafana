import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type IconName } from '@grafana/data';
import { getIconForKind } from 'app/features/search/service/icons';

/**
 * A kind whose starred objects Grafana shows. The Stars resource stores names per API group and kind; this says how
 * those names are shown and where their rows come from: every kind here is in the dashboard search index.
 */
export interface StarredKind {
  group: string;
  kind: string;
  /** The kind string search rows carry. */
  searchKind: string;
  icon: IconName;
  /** Starred lists group by this rank, alphabetical within it. */
  sortWeight: number;
}

const DASHBOARD: StarredKind = {
  group: DASHBOARD_API_GROUP,
  kind: 'Dashboard',
  searchKind: 'dashboard',
  icon: getIconForKind('dashboard'),
  sortWeight: 0,
};

const FOLDER: StarredKind = {
  group: FOLDER_API_GROUP,
  kind: 'Folder',
  searchKind: 'folder',
  icon: getIconForKind('folder'),
  sortWeight: 1,
};

/** The kinds whose stars Grafana shows, in display order. */
export const STARRED_KINDS: readonly StarredKind[] = [DASHBOARD, FOLDER];

/** The kind behind a search row's kind string; undefined for rows nobody can star, such as panels. */
export function findStarredKindBySearchKind(searchKind: string): StarredKind | undefined {
  return STARRED_KINDS.find((candidate) => candidate.searchKind === searchKind);
}
