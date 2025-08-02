import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import { ManagerKind } from 'app/features/apiserver/types';

import { rootItemsSelector, useChildrenByParentUIDState } from '../../state/hooks';
import { findItem } from '../../state/utils';

export function useFolderNameFromSelection({ folderUid, selectedItems }) {
  const rootItems = useSelector(rootItemsSelector);
  const childrenByParentUID = useChildrenByParentUIDState();

  return useMemo(() => {
    // if we already have a folderUid, return it;
    if (folderUid) {
      return folderUid;
    }

    // Helper to walk up tree and find provisioned folder
    const findProvisionedParent = (itemUid: string): string | null => {
      const item = findItem(rootItems?.items || [], childrenByParentUID, itemUid);
      if (!item) {
        return null;
      }

      if (item.managedBy === ManagerKind.Repo) {
        return item.uid;
      }
      if (item.parentUID) {
        return findProvisionedParent(item.parentUID);
      }
      return null;
    };

    // Try folders, then dashboards
    const firstSelectedUid =
      Object.keys(selectedItems.folder).find((uid) => selectedItems.folder[uid]) ||
      Object.keys(selectedItems.dashboard).find((uid) => selectedItems.dashboard[uid]);

    return firstSelectedUid ? findProvisionedParent(firstSelectedUid) : undefined;
  }, [folderUid, selectedItems, rootItems, childrenByParentUID]);
}
