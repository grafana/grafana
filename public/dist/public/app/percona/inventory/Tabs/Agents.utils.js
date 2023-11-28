import { __rest } from "tslib";
import { payloadToCamelCase } from 'app/percona/shared/helpers/payloadToCamelCase';
import { ServiceAgentStatus } from '../Inventory.types';
const MAIN_COLUMNS = ['node_id', 'agent_id', 'node_name', 'address', 'custom_labels', 'type', 'status', 'is_connected'];
export const toAgentModel = (agentList) => {
    const result = [];
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    agentList.forEach((_a) => {
        var { agent_type: agentType, status, is_connected: isConnected } = _a, agentParams = __rest(_a, ["agent_type", "status", "is_connected"]);
        const extraLabels = {};
        let agentStatus = status || ServiceAgentStatus.UNKNOWN;
        if (isConnected !== undefined) {
            agentStatus = isConnected ? ServiceAgentStatus.RUNNING : ServiceAgentStatus.UNKNOWN;
        }
        Object.entries(agentParams)
            .filter(([field]) => !MAIN_COLUMNS.includes(field))
            .forEach(([key, value]) => {
            if (Array.isArray(value) || typeof value !== 'object') {
                extraLabels[key] = value.toString();
            }
            else {
                Object.entries(value).forEach(([nestedKey, nestedValue]) => {
                    extraLabels[nestedKey] = nestedValue.toString();
                });
            }
            delete agentParams[key];
        });
        const camelCaseParams = payloadToCamelCase(agentParams, ['custom_labels']);
        // @ts-ignore
        delete camelCaseParams['custom_labels'];
        result.push({
            type: agentType,
            // @ts-ignore
            params: Object.assign(Object.assign({}, camelCaseParams), { status: agentStatus, customLabels: Object.assign(Object.assign({}, agentParams['custom_labels']), extraLabels) }),
        });
    });
    return result;
};
export const beautifyAgentType = (type) => type.replace(/^\w/, (c) => c.toUpperCase()).replace(/[_-]/g, ' ');
export const getAgentStatusColor = (status) => status === ServiceAgentStatus.STARTING || status === ServiceAgentStatus.RUNNING ? 'green' : 'red';
//# sourceMappingURL=Agents.utils.js.map