import { useCallback } from 'react';

import { AppEvents } from '@grafana/data';
import { useTranslate } from '@grafana/i18n';
import { getAppEvents, locationService } from '@grafana/runtime';
import { useDeleteRepositoryFiles } from 'app/features/provisioning/hooks/useDeleteRepositoryFiles';

import { DashboardScene } from '../../scene/DashboardScene';

interface DeleteDashboardWithNavigationOptions {
  dashboard: DashboardScene;
  onDismiss: () => void;
  onReset: () => void;
}

interface DeleteDashboardParams {
  name: string;
  path: string;
  ref: string;
  message: string;
  workflow?: 'branch' | 'write';
}

export function useDeleteProvisionedDashboardWithNavigation({
  dashboard,
  onDismiss,
  onReset,
}: DeleteDashboardWithNavigationOptions) {
  const { t } = useTranslate();
  const [deleteRepoFile, request] = useDeleteRepositoryFiles();

  const deleteWithNavigation = useCallback(
    async ({ name, path, ref, message, workflow }: DeleteDashboardParams) => {
      try {
        // Call the delete API
        await deleteRepoFile({
          name,
          path,
          ref,
          message,
        });

        // Show success message
        getAppEvents().publish({
          type: AppEvents.alertSuccess.name,
          payload: [t('dashboard-scene.delete-provisioned-dashboard-form.success', 'Dashboard deleted successfully')],
        });

        // Handle navigation based on workflow
        if (workflow === 'branch') {
          // Reset form and close drawer
          onDismiss();
          onReset();

          // Navigate back to dashboard view with ref parameter
          const currentLocation = locationService.getLocation();
          const currentParams = new URLSearchParams(currentLocation.search);
          if (ref) {
            currentParams.set('ref', ref);
          }

          const dashboardUrl = dashboard.state.uid ? `/d/${dashboard.state.uid}/${dashboard.state.meta.slug}` : '/';

          locationService.push({
            pathname: dashboardUrl,
            search: currentParams.toString(),
          });
        }
      } catch (error) {
        console.error('Error deleting dashboard:', error);
        getAppEvents().publish({
          type: AppEvents.alertError.name,
          payload: ['Failed to delete dashboard', error],
        });
        throw error; // Re-throw so component can handle if needed
      }
    },
    [deleteRepoFile, dashboard, onDismiss, onReset, t]
  );

  return [deleteWithNavigation, request] as const;
}
