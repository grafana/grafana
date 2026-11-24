import { useMemo } from 'react';

import { type NavModelItem } from '@grafana/data';
import { useStarredSearch } from 'app/features/stars/hooks';
import { getStarredKinds } from 'app/features/stars/kinds';
import { useSelector } from 'app/types/store';

import { NavID, STARRED_ID_PREFIX, type StarredNavItem } from './constants';

/**
 * The nav tree as the menu shows it: the redux tree with the Starred section's children derived from the stars
 * query. The redux tree holds only the empty section the backend ships, so read the tree through this hook and
 * every reader shows the same stars as the star buttons.
 */
export function useNavTree(): NavModelItem[] {
  const navTree = useSelector((state) => state.navBarTree);
  const { rows } = useStarredSearch();
  const kinds = getStarredKinds();

  const starredChildren = useMemo(
    () =>
      // Grouped by kind, in the kinds' display order. The rows come in title order, which each group keeps
      kinds.flatMap((kind) =>
        (rows ?? [])
          .filter((row) => row.kind === kind.searchKind)
          .map(
            (row): StarredNavItem => ({
              // A dashboard and a folder may share a uid, so the kind is part of the identity
              id: `${STARRED_ID_PREFIX}${row.kind}/${row.uid}`,
              text: row.name,
              url: row.url,
              icon: kind.icon,
              starredKind: row.kind,
            })
          )
      ),
    [rows, kinds]
  );

  return useMemo(
    () => navTree.map((item) => (item.id === NavID.starred ? { ...item, children: starredChildren } : item)),
    [navTree, starredChildren]
  );
}
