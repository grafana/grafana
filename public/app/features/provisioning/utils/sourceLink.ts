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

import { RepoTypeDisplay } from '../Wizard/types';
import { isValidRepoType } from '../guards';

import { getHasTokenInstructions, getRepoFileUrl } from './git';

/**
 * Find and remove existing source links from the links array.
 * A source link is identified by its tooltip matching the source link tooltip translation.
 * Returns the links array with source links removed.
 */
export function removeExistingSourceLinks(links: DashboardLink[] | undefined): DashboardLink[] {
  if (!links) {
    return [];
  }
  // TODO This is a pretty hacky way to match the source links, needs a better alternative
  const sourceLinkTooltip = t('dashboard.source-link.tooltip', 'View source file in repository');
  return links.filter((link) => link.tooltip !== sourceLinkTooltip);
}

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

    if (!repository) {
      return undefined;
    }

    const repoType = repository.type;
    if (!getHasTokenInstructions(repoType) || !isValidRepoType(repoType)) {
      return undefined;
    }

    const sourceUrl = getRepoFileUrl({
      repoType,
      url: repository.url,
      branch: repository.branch,
      filePath: sourcePath,
      pathPrefix: repository.path,
    });
    if (!sourceUrl) {
      return undefined;
    }

    const providerName = RepoTypeDisplay[repoType];
    return {
      title: t('dashboard.source-link.title', 'Source ({{provider}})', { provider: providerName }),
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
