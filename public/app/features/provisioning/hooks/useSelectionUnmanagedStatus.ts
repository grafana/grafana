import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { config } from '@grafana/runtime';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { isProvisionedDashboard as isProvisionedDashboardFromMeta } from 'app/features/browse-dashboards/api/isProvisioned';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { useSelector } from 'app/types/store';

import { findItem } from '../../browse-dashboards/state/utils';
import { DashboardTreeSelection } from '../../browse-dashboards/types';

// This hook checks if selected items are unmanaged (not managed by any repository)
export function useSelectionUnmanagedStatus(
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>
): { hasUnmanaged: boolean; isLoading: boolean } {
  const browseState = useSelector((state) => state.browseDashboards);
  const [, stateManager] = useSearchStateManager();
  const isSearching = stateManager.hasSearchFilters();
  const provisioningEnabled = config.featureToggles.provisioning;

  const [status, setStatus] = useState({ hasUnmanaged: false, isLoading: true });
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

  // Memoize the selected item UIDs to avoid unnecessary re-runs when children are loaded
  const selectedDashboardUIDs = useMemo(
    () => Object.keys(selectedItems.dashboard || {}).filter((uid) => selectedItems.dashboard[uid]),
    [selectedItems.dashboard]
  );
  const selectedFolderUIDs = useMemo(
    () => Object.keys(selectedItems.folder || {}).filter((uid) => selectedItems.folder[uid]),
    [selectedItems.folder]
  );

  // Use a ref to always access the latest browseState without causing re-renders
  const browseStateRef = useRef(browseState);
  browseStateRef.current = browseState;

  const findItemInState = useCallback(
    (uid: string) => {
      const state = browseStateRef.current;
      const item = findItem(state.rootItems?.items || [], state.childrenByParentUID, uid);
      return item ? { parentUID: item.parentUID, managedBy: item.managedBy } : undefined;
    },
    [] // No dependencies - always uses latest state via ref
  );

  const getFolderMeta = useCallback(
    async (uid: string) => {
      if (folderCache[uid] !== undefined) {
        return folderCache[uid];
      }
      try {
        const folder = await folderClient.get(uid);
        const managedBy = folder.metadata?.annotations?.[AnnoKeyManagerKind];
        // Unmanaged if not managed by repository
        const result = managedBy !== ManagerKind.Repo;
        setFolderCache((prev) => ({ ...prev, [uid]: result }));
        return result;
      } catch {
        // If we can't fetch, assume unmanaged
        return true;
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
        // Unmanaged if not provisioned
        const result = !isProvisionedDashboardFromMeta(dto);
        setDashboardCache((prev) => ({ ...prev, [uid]: result }));
        return result;
      } catch {
        // If we can't fetch, assume unmanaged
        return true;
      }
    },
    [dashboardCache]
  );

  const checkItemUnmanaged = useCallback(
    async (uid: string, isFolder: boolean): Promise<boolean> => {
      if (isSearching) {
        return isFolder ? await getFolderMeta(uid) : await getDashboardMeta(uid);
      }

      const item = findItemInState(uid);
      if (isFolder) {
        // Unmanaged if not managed by repository
        return item?.managedBy !== ManagerKind.Repo;
      }

      // Check parent folder first for dashboards
      const parent = item?.parentUID ? findItemInState(item.parentUID) : undefined;
      if (parent?.managedBy === ManagerKind.Repo) {
        // If parent is managed, dashboard is managed
        return false;
      }

      // Unmanaged if not managed by repository
      return item?.managedBy !== ManagerKind.Repo;
    },
    [isSearching, getFolderMeta, getDashboardMeta, findItemInState]
  );

  useEffect(() => {
    if (!provisioningEnabled) {
      setStatus({ hasUnmanaged: false, isLoading: false });
      return;
    }

    const checkUnmanagedStatus = async () => {
      setStatus({ hasUnmanaged: false, isLoading: true });

      if (selectedDashboardUIDs.length === 0 && selectedFolderUIDs.length === 0) {
        setStatus({ hasUnmanaged: false, isLoading: false });
        return;
      }

      // Check all selected items
      const checks = [
        ...selectedDashboardUIDs.map((uid) => checkItemUnmanaged(uid, false)),
        ...selectedFolderUIDs.map((uid) => checkItemUnmanaged(uid, true)),
      ];

      const results = await Promise.all(checks);
      // Export should only be enabled if ALL selected items are unmanaged
      // If ANY item is managed, hasUnmanaged should be false
      const hasUnmanaged = results.length > 0 && results.every((isUnmanaged) => isUnmanaged);

      setStatus({ hasUnmanaged, isLoading: false });
    };

    checkUnmanagedStatus();
  }, [selectedDashboardUIDs, selectedFolderUIDs, provisioningEnabled, checkItemUnmanaged]);

  return status;
}

