import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

import { type RepoType } from '../Wizard/types';
import { getReadOnlyTooltipText } from '../utils/tooltip';

interface ReadOnlyBadgeProps {
  /** Type of the managing repository. Local (file) provisioning changes the tooltip copy. */
  repoType?: RepoType;
}

/**
 * Badge indicating that a managed resource is read-only and can only be changed through its
 * managing repository. Shown alongside `ManagedBadge` on folder and dashboard pages.
 */
export function ReadOnlyBadge({ repoType }: ReadOnlyBadgeProps) {
  return (
    <Badge
      color="darkgrey"
      text={t('provisioning.read-only-badge.text', 'Read only')}
      tooltip={getReadOnlyTooltipText({ isLocal: repoType === 'local' })}
    />
  );
}
