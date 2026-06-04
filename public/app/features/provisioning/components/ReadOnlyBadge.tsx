import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

import { getReadOnlyTooltipText } from '../utils/tooltip';

interface ReadOnlyBadgeProps {
  /** Whether the managing repository is local (file) provisioning, which changes the tooltip copy. */
  isLocal?: boolean;
}

/**
 * Badge indicating that a managed resource is read-only and can only be changed through its
 * managing repository. Shown alongside `ManagedBadge` on folder and dashboard pages.
 */
export function ReadOnlyBadge({ isLocal = false }: ReadOnlyBadgeProps) {
  return (
    <Badge
      color="darkgrey"
      text={t('provisioning.read-only-badge.text', 'Read only')}
      tooltip={getReadOnlyTooltipText({ isLocal })}
    />
  );
}
