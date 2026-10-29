import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

interface ReadOnlyBadgeProps {
  /** Explains why the resource can't be changed. */
  tooltip: string;
  /** Show only a padlock icon, for tight spaces such as picker rows. */
  compact?: boolean;
}

/**
 * Badge indicating that a resource is read-only for the current user.
 */
export function ReadOnlyBadge({ tooltip, compact = false }: ReadOnlyBadgeProps) {
  const text = t('read-only-badge.text', 'Read only');

  if (compact) {
    return <Badge color="darkgrey" icon="lock" tooltip={tooltip} role="img" aria-label={text} />;
  }

  return <Badge color="darkgrey" text={text} tooltip={tooltip} />;
}
