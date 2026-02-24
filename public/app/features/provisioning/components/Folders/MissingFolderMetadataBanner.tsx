import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { Permissions } from 'app/core/components/AccessControl/Permissions';

import { useFolderMetadataStatus } from '../../hooks/useFolderMetadataStatus';

export function MissingFolderMetadataBanner() {
  return (
    <Alert
      severity="warning"
      title={t(
        'provisioning.missing-folder-metadata-banner.title',
        'This folder is missing metadata file in repository.'
      )}
    >
      <Trans i18nKey="provisioning.missing-folder-metadata-banner.message">
        Permissions may not persist if the folder is moved or renamed.
      </Trans>
    </Alert>
  );
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

interface FolderPermissionsProps {
  folderUID: string;
  canSetPermissions: boolean;
}

export function FolderPermissions({ folderUID, canSetPermissions }: FolderPermissionsProps) {
  if (!config.featureToggles.provisioning || !config.featureToggles.provisioningFolderMetadata) {
    return <Permissions resource="folders" resourceId={folderUID} canSetPermissions={canSetPermissions} />;
  }

  return <FolderPermissionsWithMetadataCheck folderUID={folderUID} canSetPermissions={canSetPermissions} />;
}

function FolderPermissionsWithMetadataCheck({ folderUID, canSetPermissions }: FolderPermissionsProps) {
  const metadataStatus = useFolderMetadataStatus(folderUID);

  switch (metadataStatus) {
    case 'loading':
      return <LoadingPlaceholder text={t('provisioning.folder-permissions.loading', 'Loading...')} />;
    case 'missing':
      return <MissingFolderMetadataBanner />;
    case 'error':
      return <MetadataErrorAlert />;
    case 'ok':
      return <Permissions resource="folders" resourceId={folderUID} canSetPermissions={canSetPermissions} />;
  }
}
