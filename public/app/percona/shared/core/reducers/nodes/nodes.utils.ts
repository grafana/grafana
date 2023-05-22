/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { Node, NodeDB } from 'app/percona/inventory/Inventory.types';
import { getAgentsMonitoringStatus } from 'app/percona/inventory/Tabs/Services.utils';
import { DbAgent } from 'app/percona/shared/services/services/Services.types';

const MAIN_COLUMNS = ['address', 'services', 'agents', 'node_type', 'node_id', 'node_name', 'status', 'custom_labels'];

export const nodeFromDbMapper = (nodeFromDb: NodeDB[]) => {
  return nodeFromDb.map((node) => {
    const properties: Record<string, string> = {};

    Object.entries(node)
      .filter(([field]) => !MAIN_COLUMNS.includes(field))
      .forEach(([key, value]: [string, string]) => {
        if (typeof value !== 'object' || Array.isArray(value)) {
          properties[key] = value;
        }
      });

    const agents: DbAgent[] | undefined = node.agents?.map(
      (agent) =>
        ({
          agentId: agent.agent_id,
          agentType: agent.agent_type,
          status: agent.status,
          isConnected: agent.is_connected,
        } as DbAgent)
    );

    return {
      nodeId: node.node_id,
      nodeType: node.node_type,
      nodeName: node.node_name,
      machineId: node.machine_id,
      distro: node.distro,
      address: node.address,
      nodeModel: node.node_model,
      region: node.region,
      az: node.az,
      containerId: node.container_id,
      containerName: node.container_name,
      customLabels: node.custom_labels,
      agents: agents,
      createdAt: node.created_at,
      updatedAt: node.updated_at,
      status: node.status,
      services: node.services?.map((service) => ({
        serviceId: service.service_id,
        serviceType: service.service_type,
        serviceName: service.service_name,
      })),
      properties: properties,
      agentsStatus: getAgentsMonitoringStatus(agents ?? []),
    } as Node;
  });
};
