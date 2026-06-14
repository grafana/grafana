import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';

import { RepoTypeDisplay } from '../Wizard/types';
import { isValidRepoType } from '../guards';
import { useGetResourceRepositoryView } from '../hooks/useGetResourceRepositoryView';
import { getHasTokenInstructions, getRepoFileUrl } from '../utils/git';

interface SourceLinkProps {
  /** The managing repository name (`grafana.app/managerId`). */
  repositoryName?: string;
  /** Path of the resource's source file within the repository (`grafana.app/sourcePath`). */
  sourcePath?: string;
}

/**
 * Link button that opens a repository-managed resource's source file in its git provider, styled
 * like the external links shown on dashboards. Renders nothing when there is no resolvable git
 * source (not repository-managed, local/generic-git provisioning, or no source path).
 */
export function SourceLink({ repositoryName, sourcePath }: SourceLinkProps) {
  const skipQuery = !config.featureToggles.provisioning || !repositoryName || !sourcePath;
  const { repository } = useGetResourceRepositoryView({ name: skipQuery ? undefined : repositoryName, skipQuery });

  if (skipQuery || !repository) {
    return null;
  }

  const repoType = repository.type;
  // Only git providers with a web UI expose a linkable file URL.
  if (!isValidRepoType(repoType) || !getHasTokenInstructions(repoType)) {
    return null;
  }

  const url = getRepoFileUrl({
    repoType,
    url: repository.url,
    branch: repository.branch,
    filePath: sourcePath,
    pathPrefix: repository.path,
  });

  if (!url) {
    return null;
  }

  return (
    <LinkButton
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      icon="external-link-alt"
      variant="secondary"
      size="sm"
    >
      {t('provisioning.source-link.title', 'Source ({{provider}})', { provider: RepoTypeDisplay[repoType] })}
    </LinkButton>
  );
}
