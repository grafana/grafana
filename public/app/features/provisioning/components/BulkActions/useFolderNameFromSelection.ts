import { useMemo } from 'react';

import { ManagerKind } from 'app/features/apiserver/types';
import { rootItemsSelector, useChildrenByParentUIDState } from 'app/features/browse-dashboards/state/hooks';
import { findItem } from 'app/features/browse-dashboards/state/utils';
import { DashboardTreeSelection } from 'app/features/browse-dashboards/types';
import { useSelector } from 'app/types/store';

// This hook retrieves the folder UID from the selection state. Because search endpoint currently does not return resource metadata
// NOTE: This is a temporary workaround until the search endpoint is updated
interface Props {
  folderUid?: string;
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>;
}
export function useFolderNameFromSelection({ folderUid, selectedItems }: Props) {
  const rootItems = useSelector(rootItemsSelector);
  const childrenByParentUID = useChildrenByParentUIDState();

  return useMemo(() => {
    // if we already have a folderUid, return it;
    if (folderUid) {
      return folderUid;
    }

    // Helper to walk up tree and find provisioned folder
    const findProvisionedParent = (itemUid: string): string | undefined => {
      const item = findItem(rootItems?.items || [], childrenByParentUID, itemUid);
      if (!item) {
        return undefined;
      }

      if (item.managedBy === ManagerKind.Repo) {
        return item.uid;
      }
      if (item.parentUID) {
        return findProvisionedParent(item.parentUID);
      }
      return undefined;
    };

    // Try folders, then dashboards
    const firstSelectedUid =
      Object.keys(selectedItems.folder).find((uid) => selectedItems.folder[uid]) ||
      Object.keys(selectedItems.dashboard).find((uid) => selectedItems.dashboard[uid]);

    return firstSelectedUid ? findProvisionedParent(firstSelectedUid) : undefined;
  }, [folderUid, selectedItems, rootItems, childrenByParentUID]);
}
