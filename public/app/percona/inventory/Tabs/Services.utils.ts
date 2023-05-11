import { BadgeColor, IconName } from '@grafana/ui';
import { DbServiceAgent, ServiceStatus } from 'app/percona/shared/services/services/Services.types';

import { MonitoringStatus, ServiceAgentStatus } from '../Inventory.types';

const SERVICE_STATUS_TO_BADGE_COLOR: Record<ServiceStatus, BadgeColor> = {
  [ServiceStatus.UP]: 'green',
  [ServiceStatus.DOWN]: 'red',
  /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */
  [ServiceStatus.UNKNOWN]: '#d7d7d7' as BadgeColor,
  /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */
  [ServiceStatus.NA]: '#d7d7d7' as BadgeColor,
};

const SERVICE_STATUS_TO_BADGE_ICON: Record<ServiceStatus, IconName> = {
  [ServiceStatus.UP]: 'check-circle',
  [ServiceStatus.DOWN]: 'times-circle',
  [ServiceStatus.UNKNOWN]: 'question-circle',
  [ServiceStatus.NA]: 'question-circle',
};

export const getBadgeColorForServiceStatus = (status: ServiceStatus) => {
  const color = SERVICE_STATUS_TO_BADGE_COLOR[status];

  return color || SERVICE_STATUS_TO_BADGE_COLOR[ServiceStatus.UNKNOWN];
};

export const getBadgeIconForServiceStatus = (status: ServiceStatus) => {
  const icon = SERVICE_STATUS_TO_BADGE_ICON[status];

  return icon || SERVICE_STATUS_TO_BADGE_ICON[ServiceStatus.UNKNOWN];
};

export const getAgentsMonitoringStatus = (agents: DbServiceAgent[]) => {
  const allAgentsOk = agents?.every(
    (agent) =>
      agent.status === ServiceAgentStatus.RUNNING || agent.status === ServiceAgentStatus.STARTING || !!agent.isConnected
  );
  return allAgentsOk ? MonitoringStatus.OK : MonitoringStatus.FAILED;
};
