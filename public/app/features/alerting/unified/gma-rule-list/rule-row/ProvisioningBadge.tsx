import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

import { managerKindName } from '../rule-data/managerKindName';

interface ProvisioningBadgeProps {
  /** Without it the tooltip only says "Provisioned". */
  managerKind?: string;
}

export function ProvisioningBadge({ managerKind }: ProvisioningBadgeProps) {
  return (
    <Badge
      text={t('alerting.gma-rule-list.shared.provisioned-badge', 'Provisioned')}
      color="purple"
      tooltip={getTooltip(managerKind)}
    />
  );
}

function getTooltip(managerKind?: string): string {
  if (!managerKind) {
    return t('alerting.gma-rule-list.shared.provisioned-tooltip', 'Provisioned');
  }

  switch (managerKind) {
    case 'classic-file-provisioning':
      return t('alerting.gma-rule-list.shared.provisioned-tooltip-file', 'Provisioned via file provisioning');
    case 'classic-api-provisioning':
      return t('alerting.gma-rule-list.shared.provisioned-tooltip-api', 'Provisioned via the provisioning API');
    default:
      return t('alerting.gma-rule-list.shared.provisioned-tooltip-manager', 'Provisioned by {{manager}}', {
        manager: managerKindName(managerKind),
      });
  }
}
