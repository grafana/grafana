import deepEqual from 'fast-deep-equal';
// Call this function to migrate queries from within the plugin.
export function migrateMetricQuery(query) {
    //add metric query migrations here
    const migratedQuery = migrateAliasPatterns(query);
    return deepEqual(migratedQuery, query) ? query : migratedQuery;
}
const aliasPatterns = {
    metric: `PROP('MetricName')`,
    namespace: `PROP('Namespace')`,
    period: `PROP('Period')`,
    region: `PROP('Region')`,
    stat: `PROP('Stat')`,
    label: `LABEL`,
};
// migrateAliasPatterns in the context of https://github.com/grafana/grafana/issues/48434
export function migrateAliasPatterns(query) {
    var _a, _b;
    if (!query.hasOwnProperty('label')) {
        const newQuery = Object.assign({}, query);
        if (!query.hasOwnProperty('label')) {
            const regex = /{{\s*(.+?)\s*}}/g;
            newQuery.label =
                (_b = (_a = query.alias) === null || _a === void 0 ? void 0 : _a.replace(regex, (_, value) => {
                    if (aliasPatterns.hasOwnProperty(value)) {
                        return `\${${aliasPatterns[value]}}`;
                    }
                    return `\${PROP('Dim.${value}')}`;
                })) !== null && _b !== void 0 ? _b : '';
        }
        return newQuery;
    }
    return query;
}
//# sourceMappingURL=metricQueryMigrations.js.map