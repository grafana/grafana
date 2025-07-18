import { useCallback, useEffect, useMemo, useState } from 'react';

import { config } from '@grafana/runtime';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { isProvisionedDashboard as isProvisionedDashboardFromMeta } from 'app/features/browse-dashboards/api/isProvisioned';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { useSelector } from 'app/types/store';

import { findItem } from '../../state/utils';
import { DashboardTreeSelection } from '../../types';

export function useSelectionProvisioningStatus(
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>,
  isParentProvisioned: boolean
) {
  const browseState = useSelector((state) => state.browseDashboards);
  const isProvisionedInstance = useIsProvisionedInstance();
  const [, stateManager] = useSearchStateManager();
  const isSearching = stateManager.hasSearchFilters();
  const provisioningEnabled = config.featureToggles.provisioning;

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
        const managedBy = folder.metadata?.annotations?.[AnnoKeyManagerKind];
        const result = managedBy === ManagerKind.Repo;
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
        const dto = await getDashboardAPI().getDashboardDTO(uid);
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
        // If searching, we need provisioning status with fetching metadata
        return isFolder ? await getFolderMeta(uid) : await getDashboardMeta(uid);
      }

      const item = findItemInState(uid);
      if (isFolder) {
        return item?.managedBy === ManagerKind.Repo;
      }

      // Check parent folder first
      const parent = item?.parentUID ? findItemInState(item.parentUID) : undefined;
      if (parent?.managedBy === ManagerKind.Repo) {
        return true;
      }

      return item?.managedBy === ManagerKind.Repo;
    },
    [isSearching, getFolderMeta, getDashboardMeta, findItemInState]
  );

  useEffect(() => {
    const checkProvisioningStatus = async () => {
      // If the instance is provisioned or the parent folder is provisioned, we can skip checking individual items
      if (isProvisionedInstance || isParentProvisioned) {
        setStatus({ hasProvisioned: true, hasNonProvisioned: false });
        return;
      }

      if (!provisioningEnabled) {
        setStatus({ hasProvisioned: false, hasNonProvisioned: true });
        return;
      }

      const folders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
      const dashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);

      let hasProvisioned = false;
      let hasNonProvisioned = false;

      const allItems = [
        ...folders.map((uid) => ({ uid, isFolder: true })),
        ...dashboards.map((uid) => ({ uid, isFolder: false })),
      ];
      for (const { uid, isFolder } of allItems) {
        const isProvisioned = await checkItemProvisioning(uid, isFolder);
        isProvisioned ? (hasProvisioned = true) : (hasNonProvisioned = true);
        if (hasProvisioned && hasNonProvisioned) {
          // If we have both provisioned and non-provisioned items, we can stop checking
          break;
        }
      }

      setStatus({ hasProvisioned, hasNonProvisioned });
    };

    checkProvisioningStatus();
  }, [
    selectedItems,
    isProvisionedInstance,
    isParentProvisioned,
    isSearching,
    findItemInState,
    checkItemProvisioning,
    provisioningEnabled,
  ]);

  return status;
}
