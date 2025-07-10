import { useMemo } from 'react';

import { ManagerKind } from 'app/features/apiserver/types';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { useSelector } from 'app/types/store';

import { findItem } from '../../state/utils';
import { DashboardTreeSelection } from '../../types';

interface SelectionProvisioningStatus {
  hasProvisioned: boolean;
  hasNonProvisioned: boolean;
}

export function useSelectionProvisioningStatus(
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>,
  isParentProvisioned: boolean
): SelectionProvisioningStatus {
  const browseState = useSelector((state) => state.browseDashboards);
  const isProvisionedInstance = useIsProvisionedInstance();

  return useMemo(() => {
    if (isProvisionedInstance || isParentProvisioned) {
      // If the instance is provisioned, all resources should be considered provisioned
      return {
        hasProvisioned: true,
        hasNonProvisioned: false,
      };
    }

    let hasProvisioned = false,
      hasNonProvisioned = false;

    const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
    const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);

    // find item in Redux state
    const findItemInState = (uid: string): { parentUID?: string; managedBy?: ManagerKind } | undefined => {
      // First check browse state
      const browseItem = findItem(browseState.rootItems?.items || [], browseState.childrenByParentUID, uid);
      if (browseItem) {
        return {
          parentUID: browseItem.parentUID,
          managedBy: browseItem.managedBy,
        };
      }
      return undefined;
    };

    // Check selected folders
    for (const folderUID of selectedFolders) {
      const item = findItemInState(folderUID);
      if (item?.managedBy === ManagerKind.Repo) {
        hasProvisioned = true;
      } else {
        hasNonProvisioned = true;
      }

      // Early exit if we found both types
      if (hasProvisioned && hasNonProvisioned) {
        break;
      }
    }

    // Check selected dashboards
    for (const dashboardUID of selectedDashboards) {
      const dashboardItem = findItemInState(dashboardUID);
      let parentFolderUID = dashboardItem?.parentUID;

      // If dashboard has a parent folder → check if parent is provisioned
      // If dashboard has no parent (not found OR in root) → it's non-provisioned
      if (parentFolderUID) {
        const parentFolder = findItemInState(parentFolderUID);
        if (parentFolder?.managedBy === ManagerKind.Repo) {
          hasProvisioned = true;
        } else {
          hasNonProvisioned = true;
        }
      } else {
        hasNonProvisioned = true;
      }

      // Early exit if we found both types
      if (hasProvisioned && hasNonProvisioned) {
        break;
      }
    }

    return {
      hasProvisioned,
      hasNonProvisioned,
    };
  }, [selectedItems, browseState, isProvisionedInstance, isParentProvisioned]);
}
