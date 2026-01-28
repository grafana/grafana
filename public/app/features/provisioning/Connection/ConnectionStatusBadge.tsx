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
        color: 'darkgrey',
        text: t('provisioning.connections.status-unknown', 'Unknown'),
        icon: 'question-circle',
      };
  }
}

export function ConnectionStatusBadge({ status }: Props) {
  if (!status?.conditions?.length) {
    return null;
  }

  const config = getBadgeConfig(status);

  return <Badge color={config.color} text={config.text} icon={config.icon} />;
}
