import { capitalizeText } from 'app/percona/shared/helpers/capitalizeText';
import { ServiceStatus } from 'app/percona/shared/services/services/Services.types';
import { MonitoringStatus, ServiceAgentStatus } from '../Inventory.types';
import { stripNodeId } from './Nodes.utils';
const SERVICE_STATUS_TO_BADGE_COLOR = {
    [ServiceStatus.UP]: 'green',
    [ServiceStatus.DOWN]: 'red',
    /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */
    [ServiceStatus.UNKNOWN]: '#d7d7d7',
    /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */
    [ServiceStatus.NA]: '#d7d7d7',
};
const SERVICE_STATUS_TO_BADGE_ICON = {
    [ServiceStatus.UP]: 'check-circle',
    [ServiceStatus.DOWN]: 'times-circle',
    [ServiceStatus.UNKNOWN]: 'question-circle',
    [ServiceStatus.NA]: 'question-circle',
};
export const getBadgeColorForServiceStatus = (status) => {
    const color = SERVICE_STATUS_TO_BADGE_COLOR[status];
    return color || SERVICE_STATUS_TO_BADGE_COLOR[ServiceStatus.UNKNOWN];
};
export const getBadgeIconForServiceStatus = (status) => {
    const icon = SERVICE_STATUS_TO_BADGE_ICON[status];
    return icon || SERVICE_STATUS_TO_BADGE_ICON[ServiceStatus.UNKNOWN];
};
export const getBadgeTextForServiceStatus = (status) => {
    if (status === ServiceStatus.NA) {
        return 'N/A';
    }
    return capitalizeText(status);
};
export const getAgentsMonitoringStatus = (agents) => {
    const allAgentsOk = agents === null || agents === void 0 ? void 0 : agents.every((agent) => agent.status === ServiceAgentStatus.RUNNING || agent.status === ServiceAgentStatus.STARTING || !!agent.isConnected);
    return allAgentsOk ? MonitoringStatus.OK : MonitoringStatus.FAILED;
};
export const stripServiceId = (serviceId) => {
    const regex = /\/service_id\/(.*)/gm;
    const match = regex.exec(serviceId);
    if (match && match.length > 0) {
        return match[1] || '';
    }
    return '';
};
export const getNodeLink = (service) => {
    const nodeId = service.nodeId === 'pmm-server' ? 'pmm-server' : stripNodeId(service.nodeId);
    return `/inventory/nodes?search-text-input=${nodeId}&search-select=nodeId`;
};
//# sourceMappingURL=Services.utils.js.map