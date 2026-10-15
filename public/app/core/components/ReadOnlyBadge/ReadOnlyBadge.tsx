import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

interface ReadOnlyBadgeProps {
  /** Explains why the resource can't be changed. */
  tooltip: string;
}

/**
 * Badge indicating that a resource is read-only for the current user.
 */
export function ReadOnlyBadge({ tooltip }: ReadOnlyBadgeProps) {
  return <Badge color="darkgrey" text={t('read-only-badge.text', 'Read only')} tooltip={tooltip} />;
}
