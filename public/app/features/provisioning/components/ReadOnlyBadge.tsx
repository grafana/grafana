import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

import { type RepoType } from '../Wizard/types';
import { getReadOnlyTooltipText } from '../utils/tooltip';

interface ReadOnlyBadgeProps {
  /** Type of the managing repository. Local (file) provisioning changes the tooltip copy. */
  repoType?: RepoType;
  /** Replaces the repository tooltip, for resources that are read-only for another reason. */
  tooltip?: string;
}

/**
 * Badge indicating that a managed resource is read-only and can only be changed through its
 * managing repository. Shown alongside `ManagedBadge` on folder and dashboard pages.
 */
export function ReadOnlyBadge({ repoType, tooltip }: ReadOnlyBadgeProps) {
  return (
    <Badge
      color="darkgrey"
      text={t('provisioning.read-only-badge.text', 'Read only')}
      tooltip={tooltip ?? getReadOnlyTooltipText({ isLocal: repoType === 'local' })}
    />
  );
}
