import { Trans, t } from '@grafana/i18n';
import { config, isFetchError } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { Folder } from 'app/api/clients/folder/v1beta1';
import { RepositoryView, useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerKind, AnnoKeySourcePath, ManagerKind } from 'app/features/apiserver/types';

import { FOLDER_METADATA_FILE } from '../../constants';

interface MissingFolderMetadataBannerProps {
  repository?: RepositoryView;
  folder?: Folder;
}

function MissingFolderMetadataBannerContent({ repository, folder }: Required<MissingFolderMetadataBannerProps>) {
  const annotations = folder.metadata?.annotations;
  const sourcePath = annotations?.[AnnoKeySourcePath]?.replace(/\/+$/, '');
  const repoName = repository.name;

  const folderJsonPath = sourcePath ? `${sourcePath}/${FOLDER_METADATA_FILE}` : FOLDER_METADATA_FILE;

  const { error, isLoading } = useGetRepositoryFilesWithPathQuery({ name: repoName, path: folderJsonPath });

  if (isLoading) {
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
          Permissions may not persist if the folder is moved or renamed.
        </Trans>
      </Alert>
    );
  }

  return null;
}

export function MissingFolderMetadataBanner({ repository, folder }: MissingFolderMetadataBannerProps) {
  if (!config.featureToggles.provisioningFolderMetadata) {
    return null;
  }

  const isProvisioned = folder?.metadata?.annotations?.[AnnoKeyManagerKind] === ManagerKind.Repo;
  if (!isProvisioned || !repository || repository.type === 'local') {
    return null;
  }

  return <MissingFolderMetadataBannerContent repository={repository} folder={folder} />;
}
