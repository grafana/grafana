import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Button, LoadingPlaceholder } from '@grafana/ui';
import { Permissions } from 'app/core/components/AccessControl/Permissions';

import { useFolderMetadataStatus } from '../../hooks/useFolderMetadataStatus';

import { FixFolderMetadataDrawer } from './FixFolderMetadataDrawer';

interface MissingFolderMetadataBannerProps {
  repositoryName: string;
  variant?: 'folder' | 'repo';
}

export function MissingFolderMetadataBanner({ repositoryName, variant = 'folder' }: MissingFolderMetadataBannerProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const title =
    variant === 'folder'
      ? t('provisioning.missing-folder-metadata-banner.title', 'This folder is missing metadata.')
      : t(
          'provisioning.missing-folder-metadata-banner.repo-title',
          'Some folders are missing metadata in this repository.'
        );

  return (
    <>
      <Alert
        severity="warning"
        title={title}
        action={
          <Button variant="secondary" onClick={() => setIsDrawerOpen(true)}>
            <Trans i18nKey="provisioning.fix-folder-metadata.button">Fix folder IDs</Trans>
          </Button>
        }
      >
        {variant === 'folder' ? (
          <Trans i18nKey="provisioning.missing-folder-metadata-banner.message">
            Since this folder doesn&apos;t contain a metadata file, the folder ID is based on the folder path. If you
            move or rename the folder, the folder ID will change, and permissions may no longer apply to the folder.
          </Trans>
        ) : (
          <Trans i18nKey="provisioning.missing-folder-metadata-banner.repo-message">
            Folders without metadata files use path-based IDs. If moved or renamed, their IDs will change and
            permissions may break.
          </Trans>
        )}
      </Alert>
      {isDrawerOpen && (
        <FixFolderMetadataDrawer repositoryName={repositoryName} onDismiss={() => setIsDrawerOpen(false)} />
      )}
    </>
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
  isProvisionedFolder: boolean;
}

export function FolderPermissions({ folderUID, canSetPermissions, isProvisionedFolder }: FolderPermissionsProps) {
  const provisioningFolderMetadataEnabled = useBooleanFlagValue('provisioningFolderMetadata', false);

  if (!isProvisionedFolder || !config.featureToggles.provisioning || !provisioningFolderMetadataEnabled) {
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
