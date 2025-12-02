import { useCallback } from 'react';

import { config } from '@grafana/runtime';
import { ManagerKind } from 'app/features/apiserver/types';
import { isProvisionedDashboard as isProvisionedDashboardFromMeta } from 'app/features/browse-dashboards/api/isProvisioned';
import { findItem } from 'app/features/browse-dashboards/state/utils';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { DashboardViewItem } from 'app/features/search/types';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { useDispatch, useSelector } from 'app/types/store';

import { setItemSelectionState } from '../../browse-dashboards/state/slice';
import { BrowseDashboardsState } from '../../browse-dashboards/types';

/**
 * Hook to auto-select all unmanaged dashboards when triggered
 * Returns a function that can be called to select all unmanaged dashboards
 */
export function useAutoSelectUnmanagedDashboards() {
  const dispatch = useDispatch();
  const browseState = useSelector((state) => state.browseDashboards);
  const [, stateManager] = useSearchStateManager();
  const isSearching = stateManager.hasSearchFilters();
  const provisioningEnabled = config.featureToggles.provisioning;

  const findItemInState = useCallback(
    (uid: string, state: BrowseDashboardsState) => {
      const item = findItem(state.rootItems?.items || [], state.childrenByParentUID, uid);
      return item ? { parentUID: item.parentUID, managedBy: item.managedBy } : undefined;
    },
    []
  );

  const getAllDashboards = useCallback(
    (state: BrowseDashboardsState): DashboardViewItem[] => {
      const dashboards: DashboardViewItem[] = [];

      // Helper to recursively collect dashboards from a collection
      const collectDashboards = (collection: typeof state.rootItems, parentUID?: string) => {
        if (!collection) {
          return;
        }

        for (const item of collection.items) {
          if (item.kind === 'dashboard') {
            dashboards.push(item);
          } else if (item.kind === 'folder') {
            // Recursively collect from children
            const children = state.childrenByParentUID[item.uid];
            if (children) {
              collectDashboards(children, item.uid);
            }
          }
        }
      };

      // Start from root items
      collectDashboards(state.rootItems);

      return dashboards;
    },
    []
  );

  const checkDashboardUnmanaged = useCallback(
    async (dashboard: DashboardViewItem, state: BrowseDashboardsState): Promise<boolean> => {
      if (isSearching) {
        // In search mode, fetch dashboard metadata
        try {
          const dto = await getDashboardAPI().getDashboardDTO(dashboard.uid);
          return !isProvisionedDashboardFromMeta(dto);
        } catch {
          return false;
        }
      }

      // Check parent folder first
      if (dashboard.parentUID) {
        const parent = findItemInState(dashboard.parentUID, state);
        if (parent?.managedBy === ManagerKind.Repo) {
          // If parent is managed, dashboard is managed
          return false;
        }
      }

      // Check dashboard itself
      const item = findItemInState(dashboard.uid, state);
      return item?.managedBy !== ManagerKind.Repo;
    },
    [isSearching, findItemInState]
  );

  const selectAllUnmanagedDashboards = useCallback(async () => {
    if (!provisioningEnabled) {
      return;
    }

    // Get current state at the time of execution
    const currentState = browseState;
    const allDashboards = getAllDashboards(currentState);
    
    if (allDashboards.length === 0) {
      // No dashboards loaded yet, wait a bit and try again
      return;
    }

    const unmanagedDashboards: DashboardViewItem[] = [];

    // Check each dashboard to see if it's unmanaged
    for (const dashboard of allDashboards) {
      const isUnmanaged = await checkDashboardUnmanaged(dashboard, currentState);
      if (isUnmanaged) {
        unmanagedDashboards.push(dashboard);
      }
    }

    // Select all unmanaged dashboards
    for (const dashboard of unmanagedDashboards) {
      dispatch(
        setItemSelectionState({
          item: {
            kind: dashboard.kind,
            uid: dashboard.uid,
            parentUID: dashboard.parentUID,
            managedBy: dashboard.managedBy,
          },
          isSelected: true,
        })
      );
    }
  }, [provisioningEnabled, browseState, getAllDashboards, checkDashboardUnmanaged, dispatch]);

  return selectAllUnmanagedDashboards;
}

