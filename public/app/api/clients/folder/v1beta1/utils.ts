import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import appEvents from '../../../../core/app_events';
import { isProvisionedFolder } from '../../../../features/browse-dashboards/api/isProvisioned';
import { useDispatch } from '../../../../types/store';

import { folderAPIv1beta1 as folderAPI } from './index';

export async function isProvisionedFolderCheck(dispatch: ReturnType<typeof useDispatch>, folderUID: string) {
  if (config.featureToggles.provisioning) {
    const folder = await dispatch(folderAPI.endpoints.getFolder.initiate({ name: folderUID }));
    // TODO: taken from browseDashboardAPI as it is, but this error handling should be moved up to UI code.
    if (folder.data && isProvisionedFolder(folder.data)) {
      appEvents.publish({
        type: AppEvents.alertWarning.name,
        payload: [
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
