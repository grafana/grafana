export function isMetricAggregationWithMeta(metric) {
    if (!metric || typeof metric !== 'object') {
        return false;
    }
    return 'meta' in metric;
}
//# sourceMappingURL=guards.js.map