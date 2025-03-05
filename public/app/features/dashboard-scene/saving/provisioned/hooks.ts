import { skipToken } from '@reduxjs/toolkit/query/react';
import { Chance } from 'chance';

import { dateTime } from '@grafana/data';
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
  const random = Chance(1);
  const timestamp = `${dateTime().format('YYYY-MM-DD')}-${random.string({ length: 5, alpha: true })}`;

  return {
    values: {
      ref: `dashboard/${timestamp}`,
      path: generatePath(timestamp, sourcePath, meta.slug),
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
    isNew: !managerIdentity,
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
  if (!instanceConfig) {
    return instanceConfig;
  }

  // Return the config, which targets the folder
  return items?.find((repo) => repo?.metadata?.name === folderUid);
};
