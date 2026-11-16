import { t } from '@grafana/i18n';
import { ReadOnlyBadge as BaseReadOnlyBadge } from 'app/core/components/ReadOnlyBadge/ReadOnlyBadge';

import { type RepoType } from '../Wizard/types';
import { getPullOnlyTooltipText } from '../utils/tooltip';

interface ReadOnlyBadgeProps {
  /** Type of the repository. Local (file) provisioning changes the tooltip copy. */
  repoType?: RepoType;
}

/** Badge for a repository Grafana only ever reads from. */
export function ReadOnlyBadge({ repoType }: ReadOnlyBadgeProps) {
  return (
    <BaseReadOnlyBadge
      text={t('provisioning.read-only-badge.pull-only', 'Pull only')}
      tooltip={getPullOnlyTooltipText({ isLocal: repoType === 'local' })}
    />
  );
}
