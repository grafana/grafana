import { skipToken } from '@reduxjs/toolkit/query/react';

import { useGetFolderQuery } from 'app/api/clients/folder';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, AnnoKeySourcePath } from 'app/features/apiserver/types';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { DashboardMeta } from 'app/types';

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
  const repositoryInfo = useGetResourceRepositoryView({
    name: managerKind === 'repo' ? managerIdentity : undefined,
    folderUid: meta.folderUid,
  });
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

  if (folderQuery.isLoading || !repositoryInfo) {
    return null;
  }

  return {
    values: {
      ref: `dashboard/${timestamp}`,
      path: dashboardPath,
      repo: managerIdentity || repositoryInfo?.name || '',
      comment: '',
      folder: {
        uid: meta.folderUid,
        title: '',
      },
      title: defaultTitle,
      description: defaultDescription ?? '',
      workflow: ['write'], // TODO update the view to include workflows
    },
    isNew: !meta.k8s?.name,
    isGitHub: repositoryInfo?.type === 'github',
  };
}
