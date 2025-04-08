import { Badge } from '@grafana/ui';
import { t } from 'app/core/internationalization';

export const UnusedContactPointBadge = () => (
  <Badge
    text={t('alerting.unused-contact-point-badge.text-unused', 'Unused')}
    aria-label={t('alerting.unused-contact-point-badge.aria-label-unused', 'unused')}
    color="orange"
    icon="exclamation-triangle"
    tooltip="This contact point is not used in any notification policy or alert rule"
  />
);
