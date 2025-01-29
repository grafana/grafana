import { AnnoKeyRepoName, AnnoKeyRepoPath } from 'app/features/apiserver/types';
import { useFolderRepository } from 'app/features/provisioning/hooks';
import { DashboardMeta } from 'app/types';

import { getDefaultWorkflow } from './defaults';

interface UseDefaultValuesParams {
  meta: DashboardMeta;
  defaultTitle: string;
  defaultDescription?: string;
}

function generatePath(timestamp: number, pathFromAnnotation?: string, slug?: string) {
  if (pathFromAnnotation) {
    const hashIndex = pathFromAnnotation.indexOf('#');
    return hashIndex > 0 ? pathFromAnnotation.substring(0, hashIndex) : pathFromAnnotation;
  }

  const pathSlug = slug || `new-dashboard-${timestamp}`;
  return `${pathSlug}.json`;
}

export function useDefaultValues({ meta, defaultTitle, defaultDescription }: UseDefaultValuesParams) {
  const folderRepository = useFolderRepository(meta.folderUid);
  const timestamp = Date.now();
  const annotations = meta.k8s?.annotations;
  const annoPath = annotations?.[AnnoKeyRepoPath];
  const repositoryConfig = folderRepository?.spec;
  const repositoryName = folderRepository?.metadata?.name ?? '';

  return {
    values: {
      ref: `dashboard/${timestamp}`,
      path: generatePath(timestamp, annoPath, meta.slug),
      repo: annotations?.[AnnoKeyRepoName] ?? repositoryName,
      comment: '',
      folder: {
        uid: meta.folderUid,
        title: '',
      },
      title: defaultTitle,
      description: defaultDescription ?? '',
      workflow: getDefaultWorkflow(repositoryConfig),
    },
    isNew: !annoPath,
    repositoryConfig,
    isGitHub: repositoryConfig?.type === 'github',
  };
}
