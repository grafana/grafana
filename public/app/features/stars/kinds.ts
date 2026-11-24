import { type IconName } from '@grafana/data';
import { type KindInfo } from '@grafana/runtime/unstable';
import { CORE_KINDS } from 'app/core/kinds/coreKinds';

import { APP_KIND_PAGES } from './appKindPages';

/**
 * A kind whose starred objects Grafana shows. The Stars resource stores names per API group and kind; this says how
 * those names are shown.
 */
export interface StarredKind extends Pick<KindInfo, 'group' | 'kind' | 'getLabel' | 'icon'> {
  /**
   * The kind string search rows and nav leaves carry. Optional on a core kind, required here. `dashboard` and
   * `folder` are the dashboard index's own spelling, which it filters on and labels its rows with. An app kind's
   * rows are labelled by the client, as `group/Kind`: kind names repeat across groups, and two kinds sharing a
   * string would share one entry.
   */
  searchKind: string;
  /** Starred lists group by this rank, alphabetical within it. */
  sortWeight: number;
}

/**
 * An app plugin kind. Its rows come from the kind's own search endpoint, which its plural addresses. The hits of
 * that search carry no link, so the kind needs a page to build one from the object's name.
 */
export interface StarredAppKind extends StarredKind, Pick<KindInfo, 'resource'> {
  getRoute: NonNullable<KindInfo['getRoute']>;
}

const DASHBOARD: StarredKind = { ...CORE_KINDS.dashboard, sortWeight: 0 };

const FOLDER: StarredKind = { ...CORE_KINDS.folder, sortWeight: 1 };

/**
 * The kinds of the dashboard search index whose stars Grafana shows, in display order. The index holds no app
 * kind: those are `STARRED_APP_KINDS`, and a search of the index never finds their stars.
 */
export const STARRED_KINDS: readonly StarredKind[] = [DASHBOARD, FOLDER];

// TODO: Temporary. One icon for every app kind, until a kind can declare its own
const APP_KIND_ICON: IconName = 'cube';

/** The app kinds whose stars Grafana shows. They list after Grafana's own kinds, in the order of their table. */
export const STARRED_APP_KINDS: readonly StarredAppKind[] = APP_KIND_PAGES.map(
  ({ group, kind, resource, listPath }, index) => ({
    group,
    kind,
    resource,
    searchKind: `${group}/${kind}`,
    // TODO: Temporary. The kind name stands in for a label, until a kind can declare one
    getLabel: () => kind,
    icon: APP_KIND_ICON,
    // Without the app sub path, as a core kind's route is
    getRoute: (name) => `${listPath}/${encodeURIComponent(name)}`,
    sortWeight: FOLDER.sortWeight + 1 + index,
  })
);

/** The kind behind a search row's or nav leaf's kind string; undefined for kinds nobody can star, such as panels. */
export function findStarredKindBySearchKind(searchKind: string): StarredKind | undefined {
  const isSearchKind = (candidate: StarredKind) => candidate.searchKind === searchKind;
  return STARRED_KINDS.find(isSearchKind) ?? STARRED_APP_KINDS.find(isSearchKind);
}
