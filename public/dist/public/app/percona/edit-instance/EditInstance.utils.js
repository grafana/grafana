export const getService = (result) => 
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
result[Object.keys(result)[0]];
export const getInitialValues = (service) => {
    if (service) {
        return Object.assign(Object.assign({}, service), { custom_labels: fromPayload(service.custom_labels || {}) });
    }
    return {
        environment: '',
        cluster: '',
        replication_set: '',
        custom_labels: '',
    };
};
export const fromPayload = (customLabels) => Object.entries(customLabels)
    .map(([label, value]) => label + ':' + value)
    .join('\n');
export const toPayload = (customLabels) => customLabels
    .split(/[\n\s]/)
    .filter(Boolean)
    .reduce((acc, val) => {
    const [key, value] = val.split(':');
    acc[key] = value;
    return acc;
}, {});
//# sourceMappingURL=EditInstance.utils.js.map