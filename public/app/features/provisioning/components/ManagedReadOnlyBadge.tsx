import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

import { getManagedReadOnlyTooltip } from '../utils/tooltip';

/**
 * Badge for a provisioning resource whose configuration is owned by its manager and cannot be
 * changed here. Distinct from {@link ReadOnlyBadge}, which is about a repository Grafana never
 * writes to; this one is about the resource's own configuration.
 */
export function ManagedReadOnlyBadge() {
  return (
    <Badge
      color="darkgrey"
      text={t('provisioning.managed-read-only-badge.text', 'Read only')}
      tooltip={getManagedReadOnlyTooltip()}
    />
  );
}
