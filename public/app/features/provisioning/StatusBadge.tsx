import { locationService } from '@grafana/runtime';
import { Badge, BadgeColor, IconName } from '@grafana/ui';

import { SyncStatus } from './api';
import { PROVISIONING_URL } from './constants';

interface StatusBadgeProps {
  state?: SyncStatus['state'] | '';
  name: string;
  enabled: boolean;
}

export function StatusBadge({ enabled, state, name }: StatusBadgeProps) {
  if (state === null || state === undefined) {
    return null;
  }

  let tooltip: string | undefined = undefined;
  let color: BadgeColor = 'purple';
  let text = 'Unknown';
  let icon: IconName = 'exclamation-triangle';
  switch (state) {
    case 'success':
      icon = 'check';
      text = 'Up-to-date';
      color = 'green';
      break;
    case null:
    case undefined:
    case '':
      color = 'orange';
      text = 'Pending';
      icon = 'spinner';
      tooltip = 'Waiting for health check to run';
      break;
    case 'working':
    case 'pending':
      color = 'orange';
      text = 'Pulling';
      icon = 'spinner';
      break;
    case 'error':
      color = 'red';
      text = 'Error';
      icon = 'exclamation-triangle';
      break;
    default:
      break;
  }

  if (!enabled) {
    color = 'red';
    text = 'Automatic pulling disabled';
    icon = 'info-circle';
  }
  return (
    <Badge
      color={color}
      icon={icon}
      text={text}
      style={{ cursor: 'pointer' }}
      tooltip={tooltip}
      onClick={() => {
        locationService.push(`${PROVISIONING_URL}/${name}/?tab=overview`);
      }}
    />
  );
}
