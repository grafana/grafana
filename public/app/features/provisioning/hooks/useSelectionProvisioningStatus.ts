import { useCallback, useEffect, useMemo, useState } from 'react';

import { config } from '@grafana/runtime';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { isProvisionedDashboard as isProvisionedDashboardFromMeta } from 'app/features/browse-dashboards/api/isProvisioned';
import { type SelectedItemRef, getSelectedItemRefs } from 'app/features/browse-dashboards/utils/dashboards';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { isItemManagedByRepository, isManagedByRepository } from 'app/features/provisioning/utils/managedResource';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { useSelector } from 'app/types/store';

import { findItem } from '../../browse-dashboards/state/utils';
import { type DashboardTreeSelection } from '../../browse-dashboards/types';

// Search results don't carry provisioning status yet, so resolve it per selected item.
export function useSelectionProvisioningStatus(
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>,
  isParentProvisioned: boolean
) {
  const browseState = useSelector((state) => state.browseDashboards);
  const isProvisionedInstance = useIsProvisionedInstance();
  const [, stateManager] = useSearchStateManager();
  const isSearching = stateManager.hasSearchFilters();
  const provisioningEnabled = config.provisioningEnabled;

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
    (kind: SelectedItemRef['kind'], uid: string) => {
      const item = findItem(browseState.rootItems?.items || [], browseState.childrenByParentUID, kind, uid);
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
    async (kind: SelectedItemRef['kind'], uid: string): Promise<boolean> => {
      if (isSearching) {
        return kind === 'folder' ? await getFolderMeta(uid) : await getDashboardMeta(uid);
      }

      const item = findItemInState(kind, uid);
      if (kind === 'folder') {
        return isItemManagedByRepository(item);
      }

      // Check parent folder first for dashboards
      const parent = item?.parentUID ? findItemInState('folder', item.parentUID) : undefined;
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

      if (!provisioningEnabled) {
        setStatus({ hasProvisioned: false, hasNonProvisioned: true });
        return;
      }

      const refs = getSelectedItemRefs(selectedItems);

      // If no items selected
      if (refs.length === 0) {
        setStatus({ hasProvisioned: false, hasNonProvisioned: false });
        return;
      }

      let hasProvisioned = false;
      let hasNonProvisioned = false;

      for (const { kind, uid } of refs) {
        const isProvisioned = await checkItemProvisioning(kind, uid);

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
  }, [selectedItems, isProvisionedInstance, isParentProvisioned, checkItemProvisioning, provisioningEnabled]);

  return {
    hasProvisioned: status.hasProvisioned,
    hasNonProvisioned: status.hasNonProvisioned,
  };
}
