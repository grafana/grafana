import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { Permissions } from 'app/core/components/AccessControl/Permissions';
import { getFolderPermissions } from 'app/features/browse-dashboards/permissions';
import { type FolderDTO } from 'app/types/folders';

import { useFolderMetadataStatus } from '../../hooks/useFolderMetadataStatus';
import { isItemManagedByRepository } from '../../utils/managedResource';

import { MissingFolderMetadataBanner } from './MissingFolderMetadataBanner';

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
          'provisioning.folder-permissions.no-access',
          'You do not have permission to view the permissions of this folder.'
        )}
      />
    );
  }

  if (!isItemManagedByRepository(folder) || !config.provisioningEnabled) {
    return <Permissions resource="folders" resourceId={folder.uid} canSetPermissions={canSetPermissions} />;
  }

  return <FolderPermissionsWithMetadataCheck folderUID={folder.uid} canSetPermissions={canSetPermissions} />;
}

interface MetadataCheckProps {
  folderUID: string;
  canSetPermissions: boolean;
}

function FolderPermissionsWithMetadataCheck({ folderUID, canSetPermissions }: MetadataCheckProps) {
  const { status: metadataStatus, repositoryName } = useFolderMetadataStatus(folderUID);

  switch (metadataStatus) {
    case 'loading':
      return <LoadingPlaceholder text={t('provisioning.folder-permissions.loading', 'Loading...')} />;
    case 'missing':
      return (
        <>
          <MissingFolderMetadataBanner repositoryName={repositoryName} />
          <Permissions resource="folders" resourceId={folderUID} canSetPermissions={false} />
        </>
      );
    case 'error':
      return <MetadataErrorAlert />;
    case 'ok':
    default:
      return <Permissions resource="folders" resourceId={folderUID} canSetPermissions={canSetPermissions} />;
  }
}

function MetadataErrorAlert() {
  return (
    <Alert
      severity="error"
      title={t('provisioning.missing-folder-metadata-banner.error-title', 'Unable to check folder metadata status.')}
    >
      <Trans i18nKey="provisioning.missing-folder-metadata-banner.error-message">
        Could not verify whether this folder has a metadata file. Please try again later.
      </Trans>
    </Alert>
  );
}
