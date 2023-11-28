import { locationService } from '@grafana/runtime';
export const getClustersFromServices = (services) => {
    const clusterNames = [...new Set(services.map((s) => s.cluster || ''))];
    return clusterNames.map((clusterName) => {
        var _a;
        const clusterServices = services.filter((s) => s.cluster === clusterName);
        return {
            name: clusterName || 'Non-clustered services',
            type: (_a = clusterServices[0]) === null || _a === void 0 ? void 0 : _a.type,
            services: clusterServices,
        };
    });
};
export const shouldClusterBeExpanded = (clusterName) => {
    const search = locationService.getSearchObject();
    return !!search[clusterName];
};
export const removeClusterFilters = (clusterName) => {
    const search = locationService.getSearchObject();
    locationService.partial(Object.assign(Object.assign({}, search), { [clusterName]: undefined }));
};
//# sourceMappingURL=Clusters.utils.js.map