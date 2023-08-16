import { BadgeColor, IconName } from '@grafana/ui';
import { capitalizeText } from 'app/percona/shared/helpers/capitalizeText';
import { DbAgent, ServiceStatus } from 'app/percona/shared/services/services/Services.types';

import { FlattenService, MonitoringStatus, ServiceAgentStatus } from '../Inventory.types';

import { stripNodeId } from './Nodes.utils';

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

export const getBadgeTextForServiceStatus = (status: ServiceStatus): string => {
  if (status === ServiceStatus.NA) {
    return 'N/A';
  }

  return capitalizeText(status);
};

export const getAgentsMonitoringStatus = (agents: DbAgent[]) => {
  const allAgentsOk = agents?.every(
    (agent) =>
      agent.status === ServiceAgentStatus.RUNNING || agent.status === ServiceAgentStatus.STARTING || !!agent.isConnected
  );
  return allAgentsOk ? MonitoringStatus.OK : MonitoringStatus.FAILED;
};

export const stripServiceId = (serviceId: string) => {
  const regex = /\/service_id\/(.*)/gm;
  const match = regex.exec(serviceId);

  if (match && match.length > 0) {
    return match[1] || '';
  }

  return '';
};

export const getNodeLink = (service: FlattenService) => {
  const nodeId = service.nodeId === 'pmm-server' ? 'pmm-server' : stripNodeId(service.nodeId);
  return `/inventory/nodes?search-text-input=${nodeId}&search-select=nodeId`;
};
