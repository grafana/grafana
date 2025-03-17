import { skipToken } from '@reduxjs/toolkit/query/react';

import { useGetFolderQuery } from 'app/api/clients/folder';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, AnnoKeySourcePath } from 'app/features/apiserver/types';
import { useGetResourceRepository } from 'app/features/provisioning/hooks/useGetResourceRepository';
import { useRepositoryList } from 'app/features/provisioning/hooks/useRepositoryList';
import { DashboardMeta } from 'app/types';

import { getDefaultWorkflow } from './defaults';
import { generatePath } from './utils/path';
import { generateTimestamp } from './utils/timestamp';

interface UseDefaultValuesParams {
  meta: DashboardMeta;
  defaultTitle: string;
  defaultDescription?: string;
}

export function useDefaultValues({ meta, defaultTitle, defaultDescription }: UseDefaultValuesParams) {
  const annotations = meta.k8s?.annotations;
  const managerKind = annotations?.[AnnoKeyManagerKind];
  const managerIdentity = annotations?.[AnnoKeyManagerIdentity];
  const sourcePath = annotations?.[AnnoKeySourcePath];
  const repositoryConfig = useConfig({ folderUid: meta.folderUid, managerKind, managerIdentity });
  const repository = repositoryConfig?.spec;
  const timestamp = generateTimestamp();

  // Get folder data to retrieve the folder path
  const folderQuery = useGetFolderQuery(meta.folderUid ? { name: meta.folderUid } : skipToken);

  const folderPath = meta.folderUid ? (folderQuery.data?.metadata?.annotations?.[AnnoKeySourcePath] ?? '') : '';

  const dashboardPath = generatePath({
    timestamp,
    pathFromAnnotation: sourcePath,
    slug: meta.slug,
    folderPath,
  });

  if (folderQuery.isLoading || !repositoryConfig) {
    return null;
  }

  return {
    values: {
      ref: `dashboard/${timestamp}`,
      path: dashboardPath,
      repo: managerIdentity || repositoryConfig?.metadata?.name || '',
      comment: '',
      folder: {
        uid: meta.folderUid,
        title: '',
      },
      title: defaultTitle,
      description: defaultDescription ?? '',
      workflow: getDefaultWorkflow(repository),
    },
    isNew: !meta.k8s?.name,
    repositoryConfig: repository,
    isGitHub: repository?.type === 'github',
  };
}

type UseConfigArgs = {
  folderUid?: string;
  managerKind?: string;
  managerIdentity?: string;
};
const useConfig = ({ folderUid, managerKind, managerIdentity }: UseConfigArgs) => {
  const repositoryConfig = useGetResourceRepository({
    name: managerKind === 'repo' ? managerIdentity : undefined,
    folderUid,
  });

  const [items, isLoading] = useRepositoryList(repositoryConfig ? skipToken : undefined);

  if (repositoryConfig) {
    return repositoryConfig;
  }

  if (isLoading) {
    return null;
  }
  const instanceConfig = items?.find((repo) => repo.spec?.sync.target === 'instance');
  if (instanceConfig) {
    return instanceConfig;
  }

  // Return the config, which targets the folder
  return items?.find((repo) => repo?.metadata?.name === folderUid);
};
