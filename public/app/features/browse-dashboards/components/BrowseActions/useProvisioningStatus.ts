// public/app/features/browse-dashboards/hooks/useProvisioningStatus.ts
import { useCallback, useEffect, useState } from 'react';

import { config } from '@grafana/runtime';
import { folderAPIv1beta1 as folderAPI } from 'app/api/clients/folder/v1beta1';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { useDispatch } from 'app/types/store';

import { isProvisionedDashboard, isProvisionedFolder } from '../../api/isProvisioned';
import { DashboardTreeSelection } from '../../types';

interface ProvisioningStatus {
  provisioned: {
    folders: string[];
    dashboards: string[];
  };
  nonProvisioned: {
    folders: string[];
    dashboards: string[];
  };
  isLoading: boolean;
}

export function useProvisioningStatus(
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>
): ProvisioningStatus {
  const dispatch = useDispatch();
  const [status, setStatus] = useState<ProvisioningStatus>({
    provisioned: { folders: [], dashboards: [] },
    nonProvisioned: { folders: [], dashboards: [] },
    isLoading: false,
  });

  const checkProvisioningStatus = useCallback(async () => {
    if (!config.featureToggles.provisioning) {
      return {
        provisioned: { folders: [], dashboards: [] },
        nonProvisioned: {
          folders: Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]),
          dashboards: Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]),
        },
        isLoading: false,
      };
    }

    setStatus((prev) => ({ ...prev, isLoading: true }));

    const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
    const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);

    const provisionedFolders: string[] = [];
    const nonProvisionedFolders: string[] = [];
    const provisionedDashboards: string[] = [];
    const nonProvisionedDashboards: string[] = [];

    // Check folders
    for (const folderUID of selectedFolders) {
      try {
        const folder = await dispatch(folderAPI.endpoints.getFolder.initiate({ name: folderUID }));
        if (folder?.data && isProvisionedFolder(folder.data)) {
          provisionedFolders.push(folderUID);
        } else {
          nonProvisionedFolders.push(folderUID);
        }
      } catch (error) {
        console.error(`Error checking folder ${folderUID}:`, error);
        nonProvisionedFolders.push(folderUID);
      }
    }

    // Check dashboards
    for (const dashboardUID of selectedDashboards) {
      try {
        const dashboard = await getDashboardAPI().getDashboardDTO(dashboardUID);
        if (isProvisionedDashboard(dashboard)) {
          provisionedDashboards.push(dashboardUID);
        } else {
          nonProvisionedDashboards.push(dashboardUID);
        }
      } catch (error) {
        console.error(`Error checking dashboard ${dashboardUID}:`, error);
        nonProvisionedDashboards.push(dashboardUID);
      }
    }

    return {
      provisioned: { folders: provisionedFolders, dashboards: provisionedDashboards },
      nonProvisioned: { folders: nonProvisionedFolders, dashboards: nonProvisionedDashboards },
      isLoading: false,
    };
  }, [selectedItems, dispatch]);

  useEffect(() => {
    checkProvisioningStatus().then(setStatus);
  }, [checkProvisioningStatus]);

  return status;
}
