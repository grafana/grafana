import { type KindInfo } from '@grafana/runtime/unstable';
import { CORE_KINDS, getAppKinds } from 'app/core/kinds/coreKinds';

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
}

/**
 * An app plugin kind. Its rows come from the kind's own search endpoint, which its plural addresses. The hits of
 * that search carry no link, so the kind needs a page to build one from the object's name.
 */
export interface StarredAppKind extends StarredKind, Pick<KindInfo, 'resource'> {
  getRoute: NonNullable<KindInfo['getRoute']>;
}

/**
 * The kinds of the dashboard search index whose stars Grafana shows, in display order. The index holds no app
 * kind, so a search of it never finds their stars.
 */
export const STARRED_INDEX_KINDS: readonly StarredKind[] = [CORE_KINDS.dashboard, CORE_KINDS.folder];

let registered: readonly KindInfo[] = [];
let appKinds: readonly StarredAppKind[] = [];
let allKinds: readonly StarredKind[] = STARRED_INDEX_KINDS;

// The kind registry has no change event, so its app kinds are compared on each read. The lists are rebuilt when
// they changed and are the same arrays until then, for a view to memoize on
function readAppKinds() {
  const kinds = getAppKinds();
  if (kinds.length === registered.length && kinds.every((kind, index) => kind === registered[index])) {
    return;
  }
  registered = kinds;
  appKinds = kinds.flatMap(({ group, kind, resource, getLabel, icon, getRoute }) =>
    getRoute ? [{ group, kind, resource, getLabel, icon, getRoute, searchKind: `${group}/${kind}` }] : []
  );
  allKinds = [...STARRED_INDEX_KINDS, ...appKinds];
}

/**
 * The app kinds whose stars Grafana shows: those their plugins added to the kind registry with a page, in the
 * order they were added. A kind without a page has nowhere to link its objects to.
 */
export function getStarredAppKinds(): readonly StarredAppKind[] {
  readAppKinds();
  return appKinds;
}

/** Every kind whose stars Grafana shows, in display order: the kinds of the index, then the app kinds. */
export function getStarredKinds(): readonly StarredKind[] {
  readAppKinds();
  return allKinds;
}

/** The kind with this API group and kind name, when it is one Grafana shows stars of. */
export function findStarredKind(group: string, kind: string): StarredKind | undefined {
  return getStarredKinds().find((candidate) => candidate.group === group && candidate.kind === kind);
}

/** The kind behind a search row's or nav leaf's kind string; undefined for kinds nobody can star, such as panels. */
export function findStarredKindBySearchKind(searchKind: string): StarredKind | undefined {
  return getStarredKinds().find((candidate) => candidate.searchKind === searchKind);
}
