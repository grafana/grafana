import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { Permissions } from 'app/core/components/AccessControl/Permissions';
import { PermissionsLoading } from 'app/core/components/AccessControl/PermissionsLoading';

import { useFolderMetadataStatus } from '../../hooks/useFolderMetadataStatus';

import { MissingFolderMetadataBanner } from './MissingFolderMetadataBanner';

interface ProvisionedFolderPermissionsProps {
  folderUID: string;
  canSetPermissions: boolean;
}

export function ProvisionedFolderPermissions({ folderUID, canSetPermissions }: ProvisionedFolderPermissionsProps) {
  const { status: metadataStatus, repositoryName } = useFolderMetadataStatus(folderUID);

  switch (metadataStatus) {
    case 'loading':
      return <PermissionsLoading />;
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
