import { t } from '@grafana/i18n';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { useGetFolderQueryFacade } from 'app/api/clients/folder/v1beta1/hooks';
import { FolderPermissions } from 'app/features/provisioning/components/Folders/FolderPermissions';
import { isItemManagedByRepository } from 'app/features/provisioning/utils/managedResource';

import { getFolderPermissions } from '../permissions';

export interface FolderPermissionsExposedComponentProps {
  folderUid: string;
}

/**
 * the permissions editor from the folder page's "manage permissions" drawer, for a folder the host
 * names by uid. access comes from the folder itself, as on the folder page.
 */
export function FolderPermissionsExposedComponent({ folderUid }: FolderPermissionsExposedComponentProps) {
  const { data: folder, isLoading, isError } = useGetFolderQueryFacade(folderUid);

  if (isLoading || (!folder && !isError)) {
    return <LoadingPlaceholder text={t('browse-dashboards.folder-permissions-exposed.loading', 'Loading...')} />;
  }

  if (!folder) {
    return (
      <Alert
        severity="error"
        title={t('browse-dashboards.folder-permissions-exposed.not-found', 'Unable to load this folder.')}
      />
    );
  }

  const { canViewPermissions, canSetPermissions } = getFolderPermissions(folder);
  if (!canViewPermissions) {
    return (
      <Alert
        severity="info"
        title={t(
          'browse-dashboards.folder-permissions-exposed.no-access',
          'You do not have permission to view the permissions of this folder.'
        )}
      />
    );
  }

  return (
    <FolderPermissions
      folderUID={folder.uid}
      canSetPermissions={canSetPermissions}
      isProvisionedFolder={isItemManagedByRepository(folder)}
    />
  );
}
