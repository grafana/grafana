import { BadgeColor, IconName } from '@grafana/ui';
import { capitalizeText } from 'app/percona/shared/helpers/capitalizeText';
import { DbAgent, ServiceStatus } from 'app/percona/shared/services/services/Services.types';

import { AgentType, FlattenService, MonitoringStatus, ServiceAgentStatus } from '../Inventory.types';

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

  return capitalizeText(status.split('_')[1] || '');
};

export const getAgentsMonitoringStatus = (agents: DbAgent[]) => {
  const disabledAgents = agents.filter((a) => a.disabled);
  const pgstatementsAgent = disabledAgents.find((a) => a.agentType === AgentType.qanPostgresql_pgstatements_agent);

  const allAgentsOk = agents?.every((agent) => {
    const ok =
      agent.status === ServiceAgentStatus.RUNNING ||
      agent.status === ServiceAgentStatus.STARTING ||
      (agent.disabled && agent.status === ServiceAgentStatus.DONE) ||
      !!agent.isConnected;

    return ok;
  });

  if (!allAgentsOk) {
    return MonitoringStatus.FAILED;
  }

  if (disabledAgents.length >= 2 || (disabledAgents.length === 1 && !pgstatementsAgent)) {
    return MonitoringStatus.WARNING;
  }

  return MonitoringStatus.OK;
};

export const getNodeLink = (service: FlattenService) => {
  const nodeId = service.nodeId === 'pmm-server' ? 'pmm-server' : service.nodeId;
  return `/inventory/nodes?search-text-input=${nodeId}&search-select=nodeId`;
};

export const getTagsFromLabels = (labelKeys: string[], labels: Record<string, string>) =>
  labelKeys.filter((label) => labels[label] !== '').map((label) => `${label}=${labels![label]}`);
