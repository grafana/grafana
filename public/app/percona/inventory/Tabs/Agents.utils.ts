import { BadgeColor } from '@grafana/ui';
import { capitalizeText } from 'app/percona/shared/helpers/capitalizeText';
import { payloadToCamelCase } from 'app/percona/shared/helpers/payloadToCamelCase';

import { Agent, AgentType, ServiceAgentPayload, ServiceAgentStatus } from '../Inventory.types';

import { AGENTS_MAIN_COLUMNS, AGENT_LABELS_SKIP_KEYS } from './Agents.constants';
import { AgentParamValue } from './Agents.types';

export const toAgentModel = (agentList: ServiceAgentPayload[]): Agent[] => {
  const result: Agent[] = [];

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  agentList.forEach(({ agent_type: agentType, status, is_connected: isConnected, ...agentParams }) => {
    const agentStatus = getAgentStatus(status, isConnected);
    const mainParams = getMainParams(agentParams);
    const extraLabels = getExtraLabels(agentParams);

    const camelCaseParams = payloadToCamelCase(mainParams, ['custom_labels']);
    // @ts-ignore
    delete camelCaseParams['custom_labels'];

    result.push({
      type: agentType,
      // @ts-ignore
      params: {
        ...camelCaseParams,
        status: agentStatus,
        customLabels: { ...agentParams['custom_labels'], ...extraLabels },
      },
    });
  });

  return result;
};

const getAgentStatus = (status?: ServiceAgentStatus, isConnected?: boolean): ServiceAgentStatus => {
  if (status) {
    return status;
  }

  return isConnected ? ServiceAgentStatus.RUNNING : ServiceAgentStatus.UNKNOWN;
};

export const getMainParams = (agentParams: Partial<ServiceAgentPayload>) => {
  const entries = Object.entries(agentParams).filter(([field]) => AGENTS_MAIN_COLUMNS.includes(field));
  return Object.fromEntries(entries);
};

/**
 * Gets extra labels for agents, converts nested object to a dot notation format below:
 * ```
 * {
 *   "extra_dsn_parameters": {
 *.    "allowCleartextPasswords": "1"
 *   }
 * }
 * ```
 * as
 * ```
 * {
 *   "extra_dsn_parameters.allowCleartextPasswords": "1"
 * }
 * ```
 * @param agentParams
 * @returns
 */
export const getExtraLabels = (agentParams: Partial<ServiceAgentPayload>): Record<string, string> => {
  const extraLabels: Record<string, string> = {};

  const getExtraLabelKey = (parent: string, child: string) => {
    if (AGENT_LABELS_SKIP_KEYS.includes(parent)) {
      return child;
    }

    return parent + '.' + child;
  };

  const handleExtraLabel = (parentKey: string, parentValue: AgentParamValue) => {
    if (!parentValue) {
      return;
    }

    if (Array.isArray(parentValue)) {
      extraLabels[parentKey] = parentValue.join(',');
    } else if (typeof parentValue === 'object') {
      Object.entries(parentValue).forEach(([childKey, childValue]) =>
        handleExtraLabel(getExtraLabelKey(parentKey, childKey), childValue)
      );
    } else {
      extraLabels[parentKey] = parentValue.toString();
    }
  };

  Object.entries(agentParams)
    .filter(([field]) => !AGENTS_MAIN_COLUMNS.includes(field))
    .forEach(([key, value]: [string, AgentParamValue]) => handleExtraLabel(key, value));

  return extraLabels;
};

export const getAgentStatusText = (status: ServiceAgentStatus): string => capitalizeText(status.split('_')[2] || '');

export const beautifyAgentType = (type: AgentType): string =>
  type.replace(/^\w/, (c) => c.toUpperCase()).replace(/[_-]/g, ' ');

export const getAgentStatusColor = (status: ServiceAgentStatus): BadgeColor =>
  status === ServiceAgentStatus.STARTING || status === ServiceAgentStatus.RUNNING ? 'green' : 'red';
