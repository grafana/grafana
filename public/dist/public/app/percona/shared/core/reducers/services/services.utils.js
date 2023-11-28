import { __rest } from "tslib";
import { payloadToCamelCase } from 'app/percona/shared/helpers/payloadToCamelCase';
import { ServiceStatus, } from 'app/percona/shared/services/services/Services.types';
export const MAIN_COLUMNS = [
    'service_id',
    'type',
    'service_name',
    'custom_labels',
    'node_id',
    'address',
    'port',
    'agents',
    'node_name',
    'status',
];
export const toRemoveServiceBody = (params) => ({
    service_id: params.serviceId,
    force: params.force,
});
export const toListServicesBody = (params) => ({
    node_id: params.nodeId,
    service_type: params.serviceType,
    external_group: params.externalGroup,
});
export const toLabelValue = (original, current) => {
    if (original === current) {
        return undefined;
    }
    // to clear a value set it's value to an empty string
    if (original !== undefined && current === undefined) {
        return '';
    }
    return current;
};
export const toUpdateServiceBody = ({ serviceId, labels, current }) => ({
    service_id: serviceId,
    environment: toLabelValue(current.enviroment, labels.environment),
    cluster: toLabelValue(current.cluster, labels.cluster),
    replication_set: toLabelValue(current.replication_set, labels.replication_set),
});
export const toCustomLabelsBodies = (params) => {
    const original = params.current.custom_labels;
    if (!original) {
        return [
            {
                service_id: params.serviceId,
                custom_labels: params.custom_labels,
            },
            {
                service_id: params.serviceId,
                custom_label_keys: [],
            },
        ];
    }
    const toAddOrUpdate = {};
    const toRemove = [];
    for (const label of Object.keys(Object.assign(Object.assign({}, original), params.custom_labels))) {
        if (original[label] !== undefined && params.custom_labels[label] === undefined) {
            toRemove.push(label);
        }
        else if (original[label] === undefined && params.custom_labels[label] !== undefined) {
            toAddOrUpdate[label] = params.custom_labels[label];
        }
        else if (original[label] !== params.custom_labels[label]) {
            toAddOrUpdate[label] = params.custom_labels[label];
        }
    }
    return [
        {
            service_id: params.serviceId,
            custom_labels: toAddOrUpdate,
        },
        {
            service_id: params.serviceId,
            custom_label_keys: toRemove,
        },
    ];
};
export const didStandardLabelsChange = ({ current, labels }) => current.enviroment !== labels.environment ||
    current.cluster !== labels.cluster ||
    current.replication_set !== labels.replication_set;
export const hasLabelsToAddOrUpdate = (body) => !!Object.keys(body.custom_labels).length;
export const hasLabelsToRemove = (body) => !!body.custom_label_keys.length;
export const toDbServicesModel = (serviceList) => {
    const result = [];
    const { services = [] } = serviceList;
    services.forEach((_a) => {
        var { service_type: serviceType, status } = _a, serviceParams = __rest(_a, ["service_type", "status"]);
        const extraLabels = {};
        Object.entries(serviceParams)
            .filter(([field]) => !MAIN_COLUMNS.includes(field))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .forEach(([key, value]) => {
            if (typeof value !== 'object' || Array.isArray(value)) {
                extraLabels[key] = value.toString();
                // @ts-ignore
                delete serviceParams[key];
            }
        });
        const camelCaseParams = payloadToCamelCase(serviceParams, ['custom_labels']);
        // @ts-ignore
        delete camelCaseParams['custom_labels'];
        if (!status || status === 'STATUS_INVALID') {
            status = ServiceStatus.NA;
        }
        result.push({
            type: serviceType,
            // @ts-ignore
            params: Object.assign(Object.assign({}, camelCaseParams), { status, customLabels: Object.assign(Object.assign({}, serviceParams['custom_labels']), extraLabels) }),
        });
    });
    return result;
};
//# sourceMappingURL=services.utils.js.map