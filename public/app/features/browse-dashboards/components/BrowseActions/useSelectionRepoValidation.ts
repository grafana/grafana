import { useMemo, useCallback } from 'react';

import { useSelector } from 'app/types/store';

import { useChildrenByParentUIDState, rootItemsSelector } from '../../state/hooks';
import { findItem } from '../../state/utils';
import { DashboardTreeSelection } from '../../types';
import { getItemRepositoryUid } from '../utils';

type BoolMap = Record<string, boolean | undefined>;

// This hook is responsible for validating if all selected resources (dashboard folders and dashboards) are in the same repository
export function useSelectionRepoValidation(selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>) {
  const childrenByParentUID = useChildrenByParentUIDState();
  const rootItems = useSelector(rootItemsSelector);
  const items = useMemo(() => rootItems?.items ?? [], [rootItems]);

  const repoUidForItem = useCallback(
    (uid: string): string | null => {
      const item = findItem(items, childrenByParentUID, uid);
      return item ? getItemRepositoryUid(item, items, childrenByParentUID) : null;
    },
    [items, childrenByParentUID]
  );

  const selectedUIDs = useMemo(() => {
    // collect selected UIDs
    return [...flattenSelected(selectedItems?.folder), ...flattenSelected(selectedItems?.dashboard)];
  }, [selectedItems]);

  const selectedItemsRepoUID = useMemo(() => {
    const firstUid = selectedUIDs[0];
    if (!firstUid) {
    }
    return repoUidForItem(firstUid) ?? undefined;
  }, [selectedUIDs, repoUidForItem]);

  const isInLockedRepo = useCallback(
    (uid: string) => {
      if (!selectedItemsRepoUID) {
        return true;
      } // nothing selected yet: allow
      const repo = repoUidForItem(uid);
      return repo === selectedItemsRepoUID;
    },
    [repoUidForItem, selectedItemsRepoUID]
  );

  return {
    selectedItemsRepoUID, // repo “lock” derived from first selected item
    isInLockedRepo, // quick predicate for UI disables
  };
}

function flattenSelected(map?: BoolMap): string[] {
  if (!map) {
    return [];
  }
  return Object.entries(map)
    .filter(([, v]) => !!v)
    .map(([uid]) => uid);
}
