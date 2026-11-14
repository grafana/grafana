import { CORE_KINDS } from 'app/core/kinds/coreKinds';
import { type KindInfo } from 'app/core/kinds/types';

/**
 * A kind whose starred objects Grafana shows. The Stars resource stores names per API group and kind; this says how
 * those names are shown and where their rows come from: every kind here is in the dashboard search index.
 */
export interface StarredKind extends KindInfo {
  /** The kind string search rows carry. */
  searchKind: string;
  /** Starred lists group by this rank, alphabetical within it. */
  sortWeight: number;
}

const DASHBOARD: StarredKind = { ...CORE_KINDS.dashboard, searchKind: 'dashboard', sortWeight: 0 };

const FOLDER: StarredKind = { ...CORE_KINDS.folder, searchKind: 'folder', sortWeight: 1 };

/** The kinds whose stars Grafana shows, in display order. */
export const STARRED_KINDS: readonly StarredKind[] = [DASHBOARD, FOLDER];

/** The kind behind a search row's kind string; undefined for rows nobody can star, such as panels. */
export function findStarredKindBySearchKind(searchKind: string): StarredKind | undefined {
  return STARRED_KINDS.find((candidate) => candidate.searchKind === searchKind);
}
