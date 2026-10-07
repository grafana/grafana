import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { Permissions } from 'app/core/components/AccessControl/Permissions';

import { useFolderMetadataStatus } from '../../hooks/useFolderMetadataStatus';

import { MissingFolderMetadataBanner } from './MissingFolderMetadataBanner';

interface FolderPermissionsProps {
  folderUID: string;
  canSetPermissions: boolean;
  isProvisionedFolder: boolean;
}

export function FolderPermissions({ folderUID, canSetPermissions, isProvisionedFolder }: FolderPermissionsProps) {
  if (!isProvisionedFolder || !config.provisioningEnabled) {
    return <Permissions resource="folders" resourceId={folderUID} canSetPermissions={canSetPermissions} />;
  }

  return <FolderPermissionsWithMetadataCheck folderUID={folderUID} canSetPermissions={canSetPermissions} />;
}

function FolderPermissionsWithMetadataCheck({
  folderUID,
  canSetPermissions,
}: Omit<FolderPermissionsProps, 'isProvisionedFolder'>) {
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
