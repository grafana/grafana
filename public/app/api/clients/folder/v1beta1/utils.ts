import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import appEvents from '../../../../core/app_events';
import { isProvisionedFolder } from '../../../../features/browse-dashboards/api/isProvisioned';
import { useDispatch } from '../../../../types/store';

import { ResourceStats } from './endpoints.gen';

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

const initialCounts: Record<string, number> = {
  folder: 0,
  dashboard: 0,
  libraryPanel: 0,
  alertRule: 0,
};

/**
 * Parses descendant counts into legacy-friendly format
 *
 * Takes the first count information as the source of truth, e.g. if
 * the array has a
 *
 * `"group": "dashboard.grafana.app"`
 *
 * entry first, and a
 *
 * `"group": "sql-fallback"`
 *
 * entry later, the `dashboard.grafana.app` count will be used
 */
export const getParsedCounts = (counts: ResourceStats[]) => {
  return counts.reduce((acc, { resource, count }) => {
    // If there's no value already, then use that count, so a fallback count is not used
    if (!acc[resource]) {
      acc[resource] = count;
    }
    return acc;
  }, initialCounts);
};
