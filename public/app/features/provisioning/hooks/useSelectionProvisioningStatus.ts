import { useCallback, useEffect, useMemo, useState } from 'react';

import { ScopedResourceClient } from 'app/features/apiserver/client';
import { isProvisionedDashboard as isProvisionedDashboardFromMeta } from 'app/features/browse-dashboards/api/isProvisioned';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { isItemManagedByRepository, isManagedByRepository } from 'app/features/provisioning/utils/managedResource';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { useSelector } from 'app/types/store';

import { findItem } from '../../browse-dashboards/state/utils';
import { type DashboardTreeSelection } from '../../browse-dashboards/types';

// This hook can be remove once searching endpoint returns provisioning status
// It is used to determine if the selected items are provisioned or not, which is currently missing from the search API
export function useSelectionProvisioningStatus(
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>,
  isParentProvisioned: boolean
) {
  const browseState = useSelector((state) => state.browseDashboards);
  const isProvisionedInstance = useIsProvisionedInstance();
  const [, stateManager] = useSearchStateManager();
  const isSearching = stateManager.hasSearchFilters();
  const [status, setStatus] = useState({ hasProvisioned: false, hasNonProvisioned: false });
  const [folderCache, setFolderCache] = useState<Record<string, boolean>>({});
  const [dashboardCache, setDashboardCache] = useState<Record<string, boolean>>({});

  // Create folder resource client for k8s API
  const folderClient = useMemo(
    () =>
      new ScopedResourceClient({
        group: 'folder.grafana.app',
        version: 'v1beta1',
        resource: 'folders',
      }),
    []
  );

  const findItemInState = useCallback(
    (uid: string) => {
      const item = findItem(browseState.rootItems?.items || [], browseState.childrenByParentUID, uid);
      return item ? { parentUID: item.parentUID, managedBy: item.managedBy } : undefined;
    },
    [browseState]
  );

  const getFolderMeta = useCallback(
    async (uid: string) => {
      if (folderCache[uid] !== undefined) {
        return folderCache[uid];
      }
      try {
        const folder = await folderClient.get(uid);
        const result = isManagedByRepository(folder);
        setFolderCache((prev) => ({ ...prev, [uid]: result }));
        return result;
      } catch {
        return false;
      }
    },
    [folderCache, folderClient]
  );

  const getDashboardMeta = useCallback(
    async (uid: string) => {
      if (dashboardCache[uid] !== undefined) {
        return dashboardCache[uid];
      }
      try {
        const api = await getDashboardAPI();
        const dto = await api.getDashboardDTO(uid);
        const result = isProvisionedDashboardFromMeta(dto);
        setDashboardCache((prev) => ({ ...prev, [uid]: result }));
        return result;
      } catch {
        return false;
      }
    },
    [dashboardCache]
  );

  const checkItemProvisioning = useCallback(
    async (uid: string, isFolder: boolean): Promise<boolean> => {
      if (isSearching) {
        return isFolder ? await getFolderMeta(uid) : await getDashboardMeta(uid);
      }

      const item = findItemInState(uid);
      if (isFolder) {
        return isItemManagedByRepository(item);
      }

      // Check parent folder first for dashboards
      const parent = item?.parentUID ? findItemInState(item.parentUID) : undefined;
      if (isItemManagedByRepository(parent)) {
        return true;
      }

      return isItemManagedByRepository(item);
    },
    [isSearching, getFolderMeta, getDashboardMeta, findItemInState]
  );

  useEffect(() => {
    const checkProvisioningStatus = async () => {
      // Early returns for simple cases
      if (isProvisionedInstance || isParentProvisioned) {
        setStatus({ hasProvisioned: true, hasNonProvisioned: false });
        return;
      }

      const folders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
      const dashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);

      // If no items selected
      if (folders.length === 0 && dashboards.length === 0) {
        setStatus({ hasProvisioned: false, hasNonProvisioned: false });
        return;
      }

      let hasProvisioned = false;
      let hasNonProvisioned = false;

      const allItems = [
        ...folders.map((uid) => ({ uid, isFolder: true })),
        ...dashboards.map((uid) => ({ uid, isFolder: false })),
      ];

      for (const { uid, isFolder } of allItems) {
        const isProvisioned = await checkItemProvisioning(uid, isFolder);

        if (isProvisioned) {
          hasProvisioned = true;
        } else {
          hasNonProvisioned = true;
        }

        if (hasProvisioned && hasNonProvisioned) {
          // If we have both, we can stop checking
          break;
        }
      }

      setStatus({ hasProvisioned, hasNonProvisioned });
    };

    checkProvisioningStatus();
  }, [selectedItems, isProvisionedInstance, isParentProvisioned, checkItemProvisioning]);

  return {
    hasProvisioned: status.hasProvisioned,
    hasNonProvisioned: status.hasNonProvisioned,
  };
}
