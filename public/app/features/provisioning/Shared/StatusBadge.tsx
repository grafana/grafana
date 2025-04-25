import { locationService } from '@grafana/runtime';
import { Badge, BadgeColor, IconName } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning';

import { PROVISIONING_URL } from '../constants';

interface StatusBadgeProps {
  repo?: Repository;
}

export function StatusBadge({ repo }: StatusBadgeProps) {
  if (!repo) {
    return null;
  }

  let tooltip: string | undefined = undefined;
  let color: BadgeColor = 'purple';
  let text = 'Unknown';
  let icon: IconName = 'exclamation-triangle';

  if (repo.metadata?.deletionTimestamp) {
    color = 'red';
    text = 'Deleting';
    icon = 'spinner';
  } else if (!repo.spec?.sync?.enabled) {
    color = 'red';
    text = 'Automatic pulling disabled';
    icon = 'info-circle';
  } else if (!repo.status?.sync?.state?.length) {
    color = 'orange';
    text = 'Pending';
    icon = 'spinner';
    tooltip = 'Waiting for health check to run';
  } else {
    // Sync state
    switch (repo.status?.sync?.state) {
      case 'success':
        icon = 'check';
        text = 'Up-to-date';
        color = 'green';
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
  }

  return (
    <Badge
      color={color}
      icon={icon}
      text={text}
      style={{ cursor: 'pointer' }}
      tooltip={tooltip}
      onClick={() => {
        locationService.push(`${PROVISIONING_URL}/${repo.metadata?.name}/?tab=overview`);
      }}
    />
  );
}
