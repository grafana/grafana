export function setCustomNamespace(query, selection) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.customNamespace) === selection) {
        return query;
    }
    if (selection === null || selection === void 0 ? void 0 : selection.toLowerCase().startsWith('microsoft.storage/storageaccounts/')) {
        return Object.assign(Object.assign({}, query), { azureMonitor: Object.assign(Object.assign({}, query.azureMonitor), { metricNamespace: selection, metricName: undefined, aggregation: undefined, timeGrain: '', dimensionFilters: [] }) });
    }
    return Object.assign(Object.assign({}, query), { azureMonitor: Object.assign(Object.assign({}, query.azureMonitor), { customNamespace: selection, metricName: undefined, aggregation: undefined, timeGrain: '', dimensionFilters: [] }) });
}
export function setMetricName(query, metricName) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.metricName) === metricName) {
        return query;
    }
    return Object.assign(Object.assign({}, query), { azureMonitor: Object.assign(Object.assign({}, query.azureMonitor), { metricName: metricName, aggregation: undefined, timeGrain: '', dimensionFilters: [] }) });
}
export function setAggregation(query, aggregation) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.aggregation) === aggregation) {
        return query;
    }
    return Object.assign(Object.assign({}, query), { azureMonitor: Object.assign(Object.assign({}, query.azureMonitor), { aggregation: aggregation }) });
}
export function setTimeGrain(query, timeGrain) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.timeGrain) === timeGrain) {
        return query;
    }
    return Object.assign(Object.assign({}, query), { azureMonitor: Object.assign(Object.assign({}, query.azureMonitor), { timeGrain: timeGrain }) });
}
export function setDimensionFilters(query, dimensions) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.dimensionFilters) === dimensions) {
        return query;
    }
    return Object.assign(Object.assign({}, query), { azureMonitor: Object.assign(Object.assign({}, query.azureMonitor), { dimensionFilters: dimensions }) });
}
export function appendDimensionFilter(query, dimension = '', operator = 'eq', filters = []) {
    var _a, _b;
    const existingFilters = (_b = (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.dimensionFilters) !== null && _b !== void 0 ? _b : [];
    return setDimensionFilters(query, [
        ...existingFilters,
        {
            dimension,
            operator,
            filters,
        },
    ]);
}
export function removeDimensionFilter(query, indexToRemove) {
    var _a, _b;
    const existingFilters = (_b = (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.dimensionFilters) !== null && _b !== void 0 ? _b : [];
    const newFilters = [...existingFilters];
    newFilters.splice(indexToRemove, 1);
    return setDimensionFilters(query, newFilters);
}
export function setDimensionFilterValue(query, index, fieldName, value) {
    var _a, _b;
    const existingFilters = (_b = (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.dimensionFilters) !== null && _b !== void 0 ? _b : [];
    const newFilters = [...existingFilters];
    const newFilter = newFilters[index];
    newFilter[fieldName] = value;
    if (fieldName === 'dimension' || fieldName === 'operator') {
        newFilter.filters = [];
    }
    return setDimensionFilters(query, newFilters);
}
export function setTop(query, top) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.top) === top) {
        return query;
    }
    return Object.assign(Object.assign({}, query), { azureMonitor: Object.assign(Object.assign({}, query.azureMonitor), { top: top }) });
}
export function setLegendAlias(query, alias) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.alias) === alias) {
        return query;
    }
    return Object.assign(Object.assign({}, query), { azureMonitor: Object.assign(Object.assign({}, query.azureMonitor), { alias: alias }) });
}
//# sourceMappingURL=setQueryValue.js.map