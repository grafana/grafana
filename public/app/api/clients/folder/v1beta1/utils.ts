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

// Maps legacy resource names emitted by the `sql-fallback` group onto the unified-storage
// resource names so both code paths collapse into a single entry. The `sql-fallback` path
// counts the legacy `library_element` table and reports it as `library_elements`, while
// unified storage reports the same resource as `librarypanels`.
const RESOURCE_NAME_ALIASES: Record<string, string> = {
  library_elements: 'librarypanels',
};

const normalizeResourceName = (resource: string): string => RESOURCE_NAME_ALIASES[resource] ?? resource;

/**
 * Normalizes a descendant counts response into a `{ resource: count }` map.
 *
 * The API may return two entries for the same resource — one from the resource's own group
 * (e.g. `dashboard.grafana.app`) and one from the `sql-fallback` group, sometimes under a
 * different legacy resource name (see `RESOURCE_NAME_ALIASES`). The non-fallback entry is
 * preferred, but a count of 0 is treated as "no data" and never beats a non-zero count,
 * even one coming from the fallback group.
 */
export const getParsedCounts = (counts: ResourceStats[]): Record<string, number> => {
  const result: Record<string, number> = {};

  for (const { resource, count, group } of counts) {
    const name = normalizeResourceName(resource);

    if (result[name] === undefined) {
      // By default, we just take the first value we see for given resource
      result[name] = count;
    } else if ((group !== 'sql-fallback' && count !== 0) || result[name] === 0) {
      // non-sql-fallback values that are not 0 will override the sql-fallback values.
      // Existing 0 values will get overridden by anything. 0 value is treated as a missing value.
      result[name] = count;
    }
  }

  return result;
};
