export const resourceValidator = (value) => {
    var _a;
    if (!value || Math.floor(value) === value) {
        return undefined;
    }
    const precision = ((_a = value.toString().split('.')[1]) === null || _a === void 0 ? void 0 : _a.length) || 0;
    return precision > 1 ? 'Only one decimal place allowed' : undefined;
};
export const canGetExpectedResources = (kubernetesCluster, values) => {
    const { memory = 0, cpu = 0, disk = 0, nodes = 0 } = values;
    return (kubernetesCluster &&
        parseInt(`${memory}`, 10) > 0 &&
        parseInt(`${cpu}`, 10) > 0 &&
        parseInt(`${disk}`, 10) > 0 &&
        parseInt(`${nodes}`, 10) > 0);
};
export const nodesValidator = (value) => {
    return value === '2' ? 'Only 1, 3 or more nodes allowed' : undefined;
};
//# sourceMappingURL=DBClusterAdvancedOptions.utils.js.map