import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

import { type RepoType } from '../Wizard/types';
import { getPullOnlyTooltipText, getReadOnlyTooltipText } from '../utils/tooltip';

interface ReadOnlyBadgeProps {
  /** Type of the managing repository. Local (file) provisioning changes the tooltip copy. */
  repoType?: RepoType;
  /**
   * What the badge is attached to. On a resource it means the resource cannot be edited here;
   * on the repository itself it means Grafana never writes to that repository, which is a
   * property of the repository's own workflows and is said differently.
   */
  subject?: 'resource' | 'repository';
}

/**
 * Badge for a repository without a write workflow: the resources it provisions can only be
 * changed through it (`subject="resource"`, the default, used on folder and dashboard pages),
 * and the repository itself is only ever read from (`subject="repository"`, used on the
 * provisioning admin surfaces).
 */
export function ReadOnlyBadge({ repoType, subject = 'resource' }: ReadOnlyBadgeProps) {
  const isLocal = repoType === 'local';

  if (subject === 'repository') {
    return (
      <Badge
        color="darkgrey"
        text={t('provisioning.read-only-badge.pull-only', 'Pull only')}
        tooltip={getPullOnlyTooltipText({ isLocal })}
      />
    );
  }

  return (
    <Badge
      color="darkgrey"
      text={t('provisioning.read-only-badge.text', 'Read only')}
      tooltip={getReadOnlyTooltipText({ isLocal })}
    />
  );
}
