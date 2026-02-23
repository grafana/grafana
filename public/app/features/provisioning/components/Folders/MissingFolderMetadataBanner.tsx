import { skipToken } from '@reduxjs/toolkit/query/react';

import { Trans, t } from '@grafana/i18n';
import { config, isFetchError } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerKind, AnnoKeySourcePath, ManagerKind } from 'app/features/apiserver/types';

import { FOLDER_METADATA_FILE } from '../../constants';
import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';

interface MissingFolderMetadataBannerProps {
  folderUID?: string;
}

function MissingFolderMetadataBannerContent({ folderUID }: { folderUID: string }) {
  const { repository, folder } = useGetResourceRepositoryView({ folderName: folderUID });

  const annotations = folder?.metadata?.annotations;
  const isProvisioned = annotations?.[AnnoKeyManagerKind] === ManagerKind.Repo;
  const sourcePath = annotations?.[AnnoKeySourcePath];
  const repoName = repository?.name;

  const shouldQuery = isProvisioned && repoName && repository?.type !== 'local';
  const folderJsonPath = shouldQuery
    ? sourcePath
      ? `${sourcePath}/${FOLDER_METADATA_FILE}`
      : FOLDER_METADATA_FILE
    : '';

  const { error, isLoading } = useGetRepositoryFilesWithPathQuery(
    shouldQuery ? { name: repoName, path: folderJsonPath } : skipToken
  );
  if (isLoading || !shouldQuery) {
    return null;
  }

  if (isFetchError(error) && error.status === 404) {
    return (
      <Alert
        severity="warning"
        title={t('provisioning.missing-folder-metadata-banner.title', 'This folder is missing stable ID metadata.')}
        style={{ flex: 0 }}
      >
        <Trans i18nKey="provisioning.missing-folder-metadata-banner.message">
          Permissions may not persist if the folder is moved or renamed in Git.
        </Trans>
      </Alert>
    );
  }

  return null;
}

export function MissingFolderMetadataBanner({ folderUID }: MissingFolderMetadataBannerProps) {
  if (!config.featureToggles.provisioningFolderMetadata || !folderUID) {
    return null;
  }

  return <MissingFolderMetadataBannerContent folderUID={folderUID} />;
}
