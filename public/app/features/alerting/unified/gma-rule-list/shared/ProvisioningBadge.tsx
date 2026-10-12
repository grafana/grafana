import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

/** Marks a rule that was created by config and cannot be edited in the UI. */
export function ProvisioningBadge() {
  return <Badge text={t('alerting.gma-rule-list.shared.provisioned-badge', 'Provisioned')} color="purple" />;
}
