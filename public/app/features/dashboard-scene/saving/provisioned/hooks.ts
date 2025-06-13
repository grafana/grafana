import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, AnnoKeySourcePath } from 'app/features/apiserver/types';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { DashboardMeta } from 'app/types';

import { getDefaultWorkflow } from './defaults';
import { generatePath } from './utils/path';
import { generateTimestamp } from './utils/timestamp';

interface UseDefaultValuesParams {
  meta: DashboardMeta;
  defaultTitle: string;
  defaultDescription?: string;
  loadedFromRef?: string;
}

export function useDefaultValues({ meta, defaultTitle, defaultDescription, loadedFromRef }: UseDefaultValuesParams) {
  const annotations = meta.k8s?.annotations;
  const managerKind = annotations?.[AnnoKeyManagerKind];
  const managerIdentity = annotations?.[AnnoKeyManagerIdentity];
  const sourcePath = annotations?.[AnnoKeySourcePath];
  const { repository, folder, isLoading } = useGetResourceRepositoryView({
    name: managerKind === 'repo' ? managerIdentity : undefined,
    folderName: meta.folderUid,
  });
  const timestamp = generateTimestamp();

  const folderPath = folder?.metadata?.annotations?.[AnnoKeySourcePath];

  const dashboardPath = generatePath({
    timestamp,
    pathFromAnnotation: sourcePath,
    slug: meta.slug,
    folderPath,
  });

  if (isLoading || !repository) {
    return null;
  }

  return {
    values: {
      ref: `dashboard/${timestamp}`,
      path: dashboardPath,
      repo: managerIdentity || repository?.name || '',
      comment: '',
      folder: {
        uid: meta.folderUid,
        title: '',
      },
      title: defaultTitle,
      description: defaultDescription ?? '',
      workflow: getDefaultWorkflow(repository, loadedFromRef),
    },
    isNew: !meta.k8s?.name,
    isGitHub: repository?.type === 'github',
    repository,
  };
}
