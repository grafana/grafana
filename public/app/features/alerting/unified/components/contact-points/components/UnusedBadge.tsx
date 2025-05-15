import { useTranslate } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

export const UnusedContactPointBadge = () => {
  const { t } = useTranslate();

  return (
    <Badge
      text={t('alerting.unused-contact-point-badge.text-unused', 'Unused')}
      aria-label={t('alerting.unused-contact-point-badge.aria-label-unused', 'unused')}
      color="orange"
      icon="exclamation-triangle"
      tooltip={t(
        'alerting.unused-contact-point-badge.tooltip-unused',
        'This contact point is not used in any notification policy or alert rule'
      )}
    />
  );
};
