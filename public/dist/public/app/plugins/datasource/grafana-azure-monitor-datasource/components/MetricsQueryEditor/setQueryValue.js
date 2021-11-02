import { __assign, __read, __spreadArray } from "tslib";
export function setSubscriptionID(query, subscriptionID) {
    if (query.subscription === subscriptionID) {
        return query;
    }
    return __assign(__assign({}, query), { subscription: subscriptionID, azureMonitor: __assign(__assign({}, query.azureMonitor), { resourceGroup: undefined }) });
}
export function setResourceGroup(query, resourceGroup) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.resourceGroup) === resourceGroup) {
        return query;
    }
    return __assign(__assign({}, query), { azureMonitor: __assign(__assign({}, query.azureMonitor), { resourceGroup: resourceGroup, resourceName: undefined }) });
}
// In the query as "metricDefinition" for some reason
export function setResourceType(query, resourceType) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.metricDefinition) === resourceType) {
        return query;
    }
    var newQuery = __assign(__assign({}, query), { azureMonitor: __assign(__assign({}, query.azureMonitor), { metricDefinition: resourceType, resourceName: undefined, metricNamespace: undefined, metricName: undefined }) });
    return newQuery;
}
export function setResourceName(query, resourceName) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.resourceName) === resourceName) {
        return query;
    }
    return __assign(__assign({}, query), { azureMonitor: __assign(__assign({}, query.azureMonitor), { resourceName: resourceName }) });
}
export function setMetricNamespace(query, metricNamespace) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.metricNamespace) === metricNamespace) {
        return query;
    }
    return __assign(__assign({}, query), { azureMonitor: __assign(__assign({}, query.azureMonitor), { metricNamespace: metricNamespace, metricName: undefined }) });
}
export function setMetricName(query, metricName) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.metricName) === metricName) {
        return query;
    }
    return __assign(__assign({}, query), { azureMonitor: __assign(__assign({}, query.azureMonitor), { metricName: metricName }) });
}
export function setAggregation(query, aggregation) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.aggregation) === aggregation) {
        return query;
    }
    return __assign(__assign({}, query), { azureMonitor: __assign(__assign({}, query.azureMonitor), { aggregation: aggregation }) });
}
export function setTimeGrain(query, timeGrain) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.timeGrain) === timeGrain) {
        return query;
    }
    return __assign(__assign({}, query), { azureMonitor: __assign(__assign({}, query.azureMonitor), { timeGrain: timeGrain }) });
}
export function setDimensionFilters(query, dimensions) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.dimensionFilters) === dimensions) {
        return query;
    }
    return __assign(__assign({}, query), { azureMonitor: __assign(__assign({}, query.azureMonitor), { dimensionFilters: dimensions }) });
}
export function appendDimensionFilter(query, dimension, operator, filter) {
    var _a, _b;
    if (dimension === void 0) { dimension = ''; }
    if (operator === void 0) { operator = 'eq'; }
    if (filter === void 0) { filter = ''; }
    var existingFilters = (_b = (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.dimensionFilters) !== null && _b !== void 0 ? _b : [];
    return setDimensionFilters(query, __spreadArray(__spreadArray([], __read(existingFilters), false), [
        {
            dimension: dimension,
            operator: operator,
            filter: filter,
        },
    ], false));
}
export function removeDimensionFilter(query, indexToRemove) {
    var _a, _b;
    var existingFilters = (_b = (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.dimensionFilters) !== null && _b !== void 0 ? _b : [];
    var newFilters = __spreadArray([], __read(existingFilters), false);
    newFilters.splice(indexToRemove, 1);
    return setDimensionFilters(query, newFilters);
}
export function setDimensionFilterValue(query, index, fieldName, value) {
    var _a, _b;
    var existingFilters = (_b = (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.dimensionFilters) !== null && _b !== void 0 ? _b : [];
    var newFilters = __spreadArray([], __read(existingFilters), false);
    var newFilter = newFilters[index];
    newFilter[fieldName] = value;
    return setDimensionFilters(query, newFilters);
}
export function setTop(query, top) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.top) === top) {
        return query;
    }
    return __assign(__assign({}, query), { azureMonitor: __assign(__assign({}, query.azureMonitor), { top: top }) });
}
export function setLegendAlias(query, alias) {
    var _a;
    if (((_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.alias) === alias) {
        return query;
    }
    return __assign(__assign({}, query), { azureMonitor: __assign(__assign({}, query.azureMonitor), { alias: alias }) });
}
//# sourceMappingURL=setQueryValue.js.map