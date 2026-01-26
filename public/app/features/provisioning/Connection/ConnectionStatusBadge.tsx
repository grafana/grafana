import { t } from '@grafana/i18n';
import { Badge, IconName } from '@grafana/ui';
import { ConnectionStatus } from 'app/api/clients/provisioning/v0alpha1';

interface Props {
  status: ConnectionStatus;
}

interface BadgeConfig {
  color: 'green' | 'red' | 'darkgrey';
  text: string;
  icon: IconName;
}

function getBadgeConfig(status: ConnectionStatus): BadgeConfig {
  const readyCondition = status.conditions?.find((c) => c.type === 'Ready');

  if (!readyCondition) {
    return {
      color: 'darkgrey',
      text: t('provisioning.connections.status-unknown', 'Unknown'),
      icon: 'question-circle',
    };
  }

  if (readyCondition.status === 'True') {
    return {
      color: 'green',
      text: t('provisioning.connections.status-connected', 'Connected'),
      icon: 'check',
    };
  }

  return {
    color: 'red',
    text: t('provisioning.connections.status-disconnected', 'Disconnected'),
    icon: 'times-circle',
  };
}

export function ConnectionStatusBadge({ status }: Props) {
  const config = getBadgeConfig(status);

  return <Badge color={config.color} text={config.text} icon={config.icon} />;
}
