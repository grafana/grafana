import { t } from '@grafana/i18n';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { useGetCombinedFolderQuery } from 'app/api/clients/folder/v1beta1/hooks';
import { isVirtualFolderUID } from 'app/api/clients/folder/v1beta1/virtualFolders';
import { FolderPermissions } from 'app/features/provisioning/components/Folders/FolderPermissions';

export interface FolderPermissionsExposedComponentProps {
  folderUid: string;
}

/**
 * the permissions editor from the folder page's "manage permissions" drawer, for a folder the host
 * names by uid. access comes from the folder itself, as on the folder page.
 */
export function FolderPermissionsExposedComponent({ folderUid }: FolderPermissionsExposedComponentProps) {
  // The root and "shared with me" folders are not stored folders, and the folder page never offers
  // their permissions. Look up nothing for them, so they report as a folder that cannot be loaded.
  const { data: folder, isLoading } = useGetCombinedFolderQuery(isVirtualFolderUID(folderUid) ? undefined : folderUid);

  if (isLoading) {
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

  return <FolderPermissions folder={folder} />;
}
