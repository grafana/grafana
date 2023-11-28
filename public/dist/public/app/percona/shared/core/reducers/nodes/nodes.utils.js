import { getAgentsMonitoringStatus } from 'app/percona/inventory/Tabs/Services.utils';
const MAIN_COLUMNS = ['address', 'services', 'agents', 'node_type', 'node_id', 'node_name', 'status', 'custom_labels'];
export const nodeFromDbMapper = (nodeFromDb) => {
    return nodeFromDb.map((node) => {
        var _a, _b;
        const properties = {};
        Object.entries(node)
            .filter(([field]) => !MAIN_COLUMNS.includes(field))
            .forEach(([key, value]) => {
            if (typeof value !== 'object' || Array.isArray(value)) {
                properties[key] = value;
            }
        });
        const agents = (_a = node.agents) === null || _a === void 0 ? void 0 : _a.map((agent) => ({
            agentId: agent.agent_id,
            agentType: agent.agent_type,
            status: agent.status,
            isConnected: agent.is_connected,
        }));
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
            services: (_b = node.services) === null || _b === void 0 ? void 0 : _b.map((service) => ({
                serviceId: service.service_id,
                serviceType: service.service_type,
                serviceName: service.service_name,
            })),
            properties: properties,
            agentsStatus: getAgentsMonitoringStatus(agents !== null && agents !== void 0 ? agents : []),
        };
    });
};
//# sourceMappingURL=nodes.utils.js.map