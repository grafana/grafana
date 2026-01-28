import { t } from '@grafana/i18n';
import { Badge, IconName } from '@grafana/ui';
import { ConnectionStatus } from 'app/api/clients/provisioning/v0alpha1';

interface Props {
  status?: ConnectionStatus;
}

interface BadgeConfig {
  color: 'green' | 'red' | 'darkgrey' | 'purple';
  text: string;
  icon: IconName;
}

function getBadgeConfig(status?: ConnectionStatus): BadgeConfig {
  // If no conditions exist or conditions array is empty, show pending state
  if (!status?.conditions || status.conditions.length === 0) {
    return {
      color: 'darkgrey',
      text: t('provisioning.connections.status-pending', 'Pending'),
      icon: 'spinner',
    };
  }

  const readyCondition = status.conditions.find((c) => c.type === 'Ready');

  // If no Ready condition exists, show pending state
  if (!readyCondition) {
    return {
      color: 'darkgrey',
      text: t('provisioning.connections.status-pending', 'Pending'),
      icon: 'spinner',
    };
  }

  switch (readyCondition.status) {
    case 'True':
      return {
        color: 'green',
        text: t('provisioning.connections.status-connected', 'Connected'),
        icon: 'check',
      };
    case 'False':
      return {
        color: 'red',
        text: t('provisioning.connections.status-disconnected', 'Disconnected'),
        icon: 'times-circle',
      };
    default:
      return {
        color: 'purple',
        text: t('provisioning.connections.status-unknown', 'Unknown'),
        icon: 'question-circle',
      };
  }
}

export function ConnectionStatusBadge({ status }: Props) {
  const config = getBadgeConfig(status);

  return <Badge color={config.color} text={config.text} icon={config.icon} />;
}
