import { useMemo } from 'react';

import { ManagerKind } from 'app/features/apiserver/types';
import { useSelector } from 'app/types/store';

import { DashboardTreeSelection } from '../../types';

interface SelectionProvisioningStatus {
  hasProvisioned: boolean;
  hasNonProvisioned: boolean;
  provisionedCount: number;
  nonProvisionedCount: number;
  totalCount: number;
}

export function useSelectionProvisioningStatus(
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>
): SelectionProvisioningStatus {
  const browseState = useSelector((state) => state.browseDashboards);

  return useMemo(() => {
    let provisionedCount = 0;
    let nonProvisionedCount = 0;

    const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
    const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);

    // find item in Redux state
    const findItemInState = (uid: string): { managedBy?: ManagerKind } | undefined => {
      // Check root items
      const rootItem = browseState.rootItems?.items.find((item) => item.uid === uid);
      if (rootItem) {
        return rootItem;
      }

      // Check children in all loaded folders
      for (const parentUID in browseState.childrenByParentUID) {
        const collection = browseState.childrenByParentUID[parentUID];
        if (collection) {
          const childItem = collection.items.find((item) => item.uid === uid);
          if (childItem) {
            return childItem;
          }
        }
      }

      return undefined;
    };

    // Check selected folders
    for (const folderUID of selectedFolders) {
      const item = findItemInState(folderUID);
      if (item?.managedBy === ManagerKind.Repo) {
        provisionedCount++;
      } else {
        nonProvisionedCount++;
      }
    }

    // Check selected dashboards
    for (const dashboardUID of selectedDashboards) {
      const item = findItemInState(dashboardUID);
      if (item?.managedBy === ManagerKind.Repo) {
        provisionedCount++;
      } else {
        nonProvisionedCount++;
      }
    }

    return {
      hasProvisioned: provisionedCount > 0,
      hasNonProvisioned: nonProvisionedCount > 0,
      provisionedCount,
      nonProvisionedCount,
      totalCount: provisionedCount + nonProvisionedCount,
    };
  }, [selectedItems, browseState]);
}
