import { type ComponentProps } from 'react';

import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';

import { useGetResourceRepositoryView } from '../hooks/useGetResourceRepositoryView';
import { getRepoFileUrl } from '../utils/git';

interface SourceLinkProps {
  /** The managing repository name (`grafana.app/managerId`). */
  repositoryName?: string;
  /** Path of the resource's source file within the repository (`grafana.app/sourcePath`). */
  sourcePath?: string;
  /** Button size, to match the surrounding actions. Defaults to `sm`. */
  size?: ComponentProps<typeof LinkButton>['size'];
}

/**
 * Link button that opens a repository-managed resource's source file in its git provider, styled
 * like the external links shown on dashboards. Renders nothing when there is no resolvable git
 * source (not repository-managed, local/generic-git provisioning, or no source path).
 */
export function SourceLink({ repositoryName, sourcePath, size = 'sm' }: SourceLinkProps) {
  const skipQuery = !config.featureToggles.provisioning || !repositoryName || !sourcePath;
  const { repository } = useGetResourceRepositoryView({ name: skipQuery ? undefined : repositoryName, skipQuery });

  if (skipQuery || !repository) {
    return null;
  }

  const repoType = repository.type;
  // getRepoFileUrl only builds a URL for git providers with a browsable web UI
  // (GitHub, GitHub Enterprise, GitLab, Bitbucket); local/generic-git resolve to undefined.
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
      icon="brackets-curly"
      variant="secondary"
      size={size}
    >
      <Trans i18nKey="provisioning.source-link.title">Source</Trans>
    </LinkButton>
  );
}
