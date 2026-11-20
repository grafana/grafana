import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button } from '@grafana/ui';

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
