import { type ResourceStats } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import { appEvents } from '../../../../core/app_events';
import { isProvisionedFolder } from '../../../../features/browse-dashboards/api/isProvisioned';
import { type useDispatch } from '../../../../types/store';

import { folderAPIv1beta1 as folderAPI } from './index';

export async function isProvisionedFolderCheck(
  dispatch: ReturnType<typeof useDispatch>,
  folderUID: string,
  options?: { warning?: string }
) {
  if (config.featureToggles.provisioning) {
    const folder = await dispatch(folderAPI.endpoints.getFolder.initiate({ name: folderUID }));
    // TODO: taken from browseDashboardAPI as it is, but this error handling should be moved up to UI code.
    if (folder.data && isProvisionedFolder(folder.data)) {
      appEvents.publish({
        type: AppEvents.alertWarning.name,
        payload: [
          options?.warning ||
            t(
              'folders.api.folder-delete-error-provisioned',
              'Cannot delete provisioned folder. To remove it, delete it from the repository and synchronise to apply the changes.'
            ),
        ],
      });
      return true;
    }
    return false;
  } else {
    return false;
  }
}

/**
 * Normalizes a descendant counts response into a `{ resource: count }` map.
 *
 * The API may return two entries for the same resource — one from the resource's own group
 * (e.g. `dashboard.grafana.app`) and one from the `sql-fallback` group. The non-fallback
 * entry wins; the fallback is only kept when no other entry exists for that resource.
 */
export const getParsedCounts = (counts: ResourceStats[]): Record<string, number> => {
  const result: Record<string, number> = {};
  const isFromFallback: Record<string, boolean> = {};

  for (const { resource, count, group } of counts) {
    const fromFallback = group === 'sql-fallback';
    if (
      // first time we see this resource count
      !(resource in result) ||
      // or we have count already, but that count is sql-fallback and now we have non fallback value
      (isFromFallback[resource] && !fromFallback)
    ) {
      result[resource] = count;
      isFromFallback[resource] = fromFallback;
    }
  }

  return result;
};
