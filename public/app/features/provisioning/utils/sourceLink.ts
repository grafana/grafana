import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { DashboardLink } from '@grafana/schema';
import { provisioningAPIv0alpha1, RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import {
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  ManagerKind,
  ObjectMeta,
} from 'app/features/apiserver/types';
import { dispatch } from 'app/store/store';

import { getHasTokenInstructions, getRepoFileUrl } from './git';

/**
 * Build a source link for a repo-managed dashboard.
 * Returns undefined if the dashboard is not repo-managed or if the repository is not a git provider.
 */
export async function buildSourceLink(annotations: ObjectMeta['annotations']): Promise<DashboardLink | undefined> {
  if (!annotations || !config.featureToggles.provisioning || annotations[AnnoKeyManagerKind] !== ManagerKind.Repo) {
    return undefined;
  }

  const managerIdentity = annotations[AnnoKeyManagerIdentity];
  const sourcePath = annotations[AnnoKeySourcePath];
  if (!managerIdentity || !sourcePath) {
    return undefined;
  }

  try {
    const settingsResult = await dispatch(provisioningAPIv0alpha1.endpoints.getFrontendSettings.initiate());
    const repository = settingsResult.data?.items.find((repo: RepositoryView) => repo.name === managerIdentity);

    if (!repository || !getHasTokenInstructions(repository.type)) {
      return undefined;
    }

    const sourceUrl = getRepoFileUrl(repository.type, repository.url, repository.branch, sourcePath, repository.path);
    if (!sourceUrl) {
      return undefined;
    }

    return {
      title: t('dashboard.source-link.title', 'Source'),
      type: 'link',
      url: sourceUrl,
      icon: 'external link',
      tooltip: t('dashboard.source-link.tooltip', 'View source file in repository'),
      targetBlank: true,
      tags: [],
      asDropdown: false,
      includeVars: false,
      keepTime: false,
    };
  } catch (e) {
    console.warn('Failed to fetch repository info for source link:', e);
    return undefined;
  }
}
