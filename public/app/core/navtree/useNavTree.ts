import { useMemo } from 'react';

import { type NavModelItem } from '@grafana/data';
import { useStarredSearch } from 'app/features/stars/hooks';
import { findStarredKindBySearchKind } from 'app/features/stars/kinds';
import { useSelector } from 'app/types/store';

import { NavID, STARRED_ID_PREFIX } from './constants';

// Created once, not per sort
const collator = new Intl.Collator();

/**
 * The nav tree as the menu shows it: the redux tree with the Starred section's children derived from the stars
 * query. The redux tree holds only the empty section the backend ships, so read the tree through this hook and
 * every reader shows the same stars as the star buttons.
 */
export function useNavTree(): NavModelItem[] {
  const navTree = useSelector((state) => state.navBarTree);
  const { rows } = useStarredSearch();

  const starredChildren = useMemo(() => {
    if (!rows) {
      return [];
    }
    return (
      rows
        // The rows are of starred kinds already; the lookup is for the icon and the sort group
        .flatMap((row) => {
          const kind = findStarredKindBySearchKind(row.kind);
          return kind ? [{ kind, row }] : [];
        })
        .sort((a, b) => a.kind.sortWeight - b.kind.sortWeight || collator.compare(a.row.name, b.row.name))
        .map(
          ({ kind, row }): NavModelItem => ({
            // A dashboard and a folder may share a uid, so the kind is part of the identity
            id: `${STARRED_ID_PREFIX}${row.kind}/${row.uid}`,
            text: row.name,
            url: row.url,
            icon: kind.icon,
            // Labels the leaf's icon and its click analytics with the kind
            starredKind: row.kind,
          })
        )
    );
  }, [rows]);

  return useMemo(
    () => navTree.map((item) => (item.id === NavID.starred ? { ...item, children: starredChildren } : item)),
    [navTree, starredChildren]
  );
}
