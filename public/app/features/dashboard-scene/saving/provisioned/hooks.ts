import { skipToken } from '@reduxjs/toolkit/query/react';
import { Chance } from 'chance';

import { dateTime } from '@grafana/data';
import { useGetFolderQuery } from 'app/api/clients/folder';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, AnnoKeySourcePath } from 'app/features/apiserver/types';
import { useGetResourceRepository, useRepositoryList } from 'app/features/provisioning/hooks';
import { DashboardMeta } from 'app/types';

import { getDefaultWorkflow } from './defaults';

interface UseDefaultValuesParams {
  meta: DashboardMeta;
  defaultTitle: string;
  defaultDescription?: string;
}

function generatePath(timestamp: string, pathFromAnnotation?: string, slug?: string) {
  if (pathFromAnnotation) {
    const hashIndex = pathFromAnnotation.indexOf('#');
    return hashIndex > 0 ? pathFromAnnotation.substring(0, hashIndex) : pathFromAnnotation;
  }

  const pathSlug = slug || `new-dashboard-${timestamp}`;
  return `${pathSlug}.json`;
}

export function useDefaultValues({ meta, defaultTitle, defaultDescription }: UseDefaultValuesParams) {
  const annotations = meta.k8s?.annotations;
  const managerKind = annotations?.[AnnoKeyManagerKind];
  const managerIdentity = annotations?.[AnnoKeyManagerIdentity];
  const sourcePath = annotations?.[AnnoKeySourcePath];
  const repositoryConfig = useConfig({ folderUid: meta.folderUid, managerKind, managerIdentity });
  const repository = repositoryConfig?.spec;
  const random = Chance();
  const timestamp = `${dateTime().format('YYYY-MM-DD')}-${random.string({ length: 5, alpha: true })}`;

  // Get folder data to retrieve the folder path
  const folderQuery = useGetFolderQuery(meta.folderUid ? { name: meta.folderUid } : skipToken);
  let dashboardPath = generatePath(timestamp, sourcePath, meta.slug);

  if (meta.folderUid) {
    const folderPath = folderQuery.data?.metadata?.annotations?.[AnnoKeySourcePath] ?? '';
    if (folderPath) {
      dashboardPath = `${folderPath}/${dashboardPath}`;
    }
  }
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
