import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { Permissions } from 'app/core/components/AccessControl/Permissions';
import { ProvisionedFolderPermissions } from 'app/features/provisioning/components/Folders/ProvisionedFolderPermissions';
import { isItemManagedByRepository } from 'app/features/provisioning/utils/managedResource';
import { type FolderDTO } from 'app/types/folders';

import { getFolderPermissions } from '../permissions';

interface FolderPermissionsProps {
  folder: FolderDTO;
}

export function FolderPermissions({ folder }: FolderPermissionsProps) {
  const { canViewPermissions, canSetPermissions } = getFolderPermissions(folder);

  if (!canViewPermissions) {
    return (
      <Alert
        severity="info"
        title={t(
          'browse-dashboards.folder-permissions.no-access',
          'You do not have permission to view the permissions of this folder.'
        )}
      />
    );
  }

  // The editor keeps the previous folder's rows until its next fetch, while its row actions already target the
  // new folder. Keyed on the folder, so it starts over for another one.
  if (isItemManagedByRepository(folder) && config.provisioningEnabled) {
    return (
      <ProvisionedFolderPermissions key={folder.uid} folderUID={folder.uid} canSetPermissions={canSetPermissions} />
    );
  }

  return (
    <Permissions key={folder.uid} resource="folders" resourceId={folder.uid} canSetPermissions={canSetPermissions} />
  );
}
