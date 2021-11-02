import { __assign, __awaiter, __generator, __read } from "tslib";
import { useState, useEffect, useMemo } from 'react';
import { hasOption, toOption } from '../../utils/common';
import { setMetricName, setMetricNamespace, setResourceGroup, setResourceName, setResourceType, setSubscriptionID, } from './setQueryValue';
export function useAsyncState(asyncFn, setError, dependencies) {
    // Use the lazy initial state functionality of useState to assign a random ID to the API call
    // to track where errors come from. See useLastError.
    var _a = __read(useState(function () { return Math.random(); }), 1), errorSource = _a[0];
    var _b = __read(useState(), 2), value = _b[0], setValue = _b[1];
    var finalValue = useMemo(function () { return value !== null && value !== void 0 ? value : []; }, [value]);
    useEffect(function () {
        asyncFn()
            .then(function (results) {
            setValue(results);
            setError(errorSource, undefined);
        })
            .catch(function (err) {
            setError(errorSource, err);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies);
    return finalValue;
}
export var useSubscriptions = function (query, datasource, onChange, setError) {
    var subscription = query.subscription;
    var defaultSubscription = datasource.azureMonitorDatasource.defaultSubscriptionId;
    var subscriptionOptions = useAsyncState(function () { return __awaiter(void 0, void 0, void 0, function () {
        var results;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, datasource.azureMonitorDatasource.getSubscriptions()];
                case 1:
                    results = _a.sent();
                    return [2 /*return*/, results.map(function (v) { return ({ label: v.text, value: v.value, description: v.value }); })];
            }
        });
    }); }, setError, []);
    useEffect(function () {
        // Return early if subscriptions havent loaded, or if the query already has a subscription
        if (!subscriptionOptions.length || (subscription && hasOption(subscriptionOptions, subscription))) {
            return;
        }
        var defaultSub = defaultSubscription || subscriptionOptions[0].value;
        if (!subscription && defaultSub && hasOption(subscriptionOptions, defaultSub)) {
            onChange(setSubscriptionID(query, defaultSub));
        }
    }, [subscriptionOptions, query, subscription, defaultSubscription, onChange]);
    return subscriptionOptions;
};
export var useResourceGroups = function (query, datasource, onChange, setError) {
    var _a;
    var subscription = query.subscription;
    var resourceGroup = ((_a = query.azureMonitor) !== null && _a !== void 0 ? _a : {}).resourceGroup;
    return useAsyncState(function () { return __awaiter(void 0, void 0, void 0, function () {
        var results, options;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!subscription) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, datasource.getResourceGroups(subscription)];
                case 1:
                    results = _a.sent();
                    options = results.map(toOption);
                    if (isInvalidOption(resourceGroup, options, datasource.getVariables())) {
                        onChange(setResourceGroup(query, undefined));
                    }
                    return [2 /*return*/, options];
            }
        });
    }); }, setError, [subscription]);
};
export var useResourceTypes = function (query, datasource, onChange, setError) {
    var _a;
    var subscription = query.subscription;
    var _b = (_a = query.azureMonitor) !== null && _a !== void 0 ? _a : {}, resourceGroup = _b.resourceGroup, metricDefinition = _b.metricDefinition;
    return useAsyncState(function () { return __awaiter(void 0, void 0, void 0, function () {
        var results, options;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(subscription && resourceGroup)) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, datasource.getMetricDefinitions(subscription, resourceGroup)];
                case 1:
                    results = _a.sent();
                    options = results.map(toOption);
                    if (isInvalidOption(metricDefinition, options, datasource.getVariables())) {
                        onChange(setResourceType(query, undefined));
                    }
                    return [2 /*return*/, options];
            }
        });
    }); }, setError, [subscription, resourceGroup]);
};
export var useResourceNames = function (query, datasource, onChange, setError) {
    var _a;
    var subscription = query.subscription;
    var _b = (_a = query.azureMonitor) !== null && _a !== void 0 ? _a : {}, resourceGroup = _b.resourceGroup, metricDefinition = _b.metricDefinition, resourceName = _b.resourceName;
    return useAsyncState(function () { return __awaiter(void 0, void 0, void 0, function () {
        var results, options;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(subscription && resourceGroup && metricDefinition)) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, datasource.getResourceNames(subscription, resourceGroup, metricDefinition)];
                case 1:
                    results = _a.sent();
                    options = results.map(toOption);
                    if (isInvalidOption(resourceName, options, datasource.getVariables())) {
                        onChange(setResourceName(query, undefined));
                    }
                    return [2 /*return*/, options];
            }
        });
    }); }, setError, [subscription, resourceGroup, metricDefinition]);
};
export var useMetricNamespaces = function (query, datasource, onChange, setError) {
    var _a;
    var subscription = query.subscription;
    var _b = (_a = query.azureMonitor) !== null && _a !== void 0 ? _a : {}, resourceGroup = _b.resourceGroup, metricDefinition = _b.metricDefinition, resourceName = _b.resourceName, metricNamespace = _b.metricNamespace;
    var metricNamespaces = useAsyncState(function () { return __awaiter(void 0, void 0, void 0, function () {
        var results, options;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(subscription && resourceGroup && metricDefinition && resourceName)) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, datasource.getMetricNamespaces(subscription, resourceGroup, metricDefinition, resourceName)];
                case 1:
                    results = _a.sent();
                    options = results.map(toOption);
                    // Do some cleanup of the query state if need be
                    if (!metricNamespace && options.length) {
                        onChange(setMetricNamespace(query, options[0].value));
                    }
                    else if (options[0] && isInvalidOption(metricNamespace, options, datasource.getVariables())) {
                        onChange(setMetricNamespace(query, options[0].value));
                    }
                    return [2 /*return*/, options];
            }
        });
    }); }, setError, [subscription, resourceGroup, metricDefinition, resourceName]);
    return metricNamespaces;
};
export var useMetricNames = function (query, datasource, onChange, setError) {
    var _a;
    var subscription = query.subscription;
    var _b = (_a = query.azureMonitor) !== null && _a !== void 0 ? _a : {}, resourceGroup = _b.resourceGroup, metricDefinition = _b.metricDefinition, resourceName = _b.resourceName, metricNamespace = _b.metricNamespace, metricName = _b.metricName;
    return useAsyncState(function () { return __awaiter(void 0, void 0, void 0, function () {
        var results, options;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(subscription && resourceGroup && metricDefinition && resourceName && metricNamespace)) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, datasource.getMetricNames(subscription, resourceGroup, metricDefinition, resourceName, metricNamespace)];
                case 1:
                    results = _a.sent();
                    options = results.map(toOption);
                    if (isInvalidOption(metricName, options, datasource.getVariables())) {
                        onChange(setMetricName(query, undefined));
                    }
                    return [2 /*return*/, options];
            }
        });
    }); }, setError, [subscription, resourceGroup, metricDefinition, resourceName, metricNamespace]);
};
export var useMetricMetadata = function (query, datasource, onChange) {
    var _a;
    var _b = __read(useState({
        aggOptions: [],
        timeGrains: [],
        dimensions: [],
        isLoading: false,
        supportedAggTypes: [],
        primaryAggType: undefined,
    }), 2), metricMetadata = _b[0], setMetricMetadata = _b[1];
    var subscription = query.subscription;
    var _c = (_a = query.azureMonitor) !== null && _a !== void 0 ? _a : {}, resourceGroup = _c.resourceGroup, metricDefinition = _c.metricDefinition, resourceName = _c.resourceName, metricNamespace = _c.metricNamespace, metricName = _c.metricName, aggregation = _c.aggregation, timeGrain = _c.timeGrain;
    // Fetch new metric metadata when the fields change
    useEffect(function () {
        if (!(subscription && resourceGroup && metricDefinition && resourceName && metricNamespace && metricName)) {
            return;
        }
        datasource
            .getMetricMetadata(subscription, resourceGroup, metricDefinition, resourceName, metricNamespace, metricName)
            .then(function (metadata) {
            var _a;
            // TODO: Move the aggregationTypes and timeGrain defaults into `getMetricMetadata`
            var aggregations = (metadata.supportedAggTypes || [metadata.primaryAggType]).map(function (v) { return ({
                label: v,
                value: v,
            }); });
            setMetricMetadata({
                aggOptions: aggregations,
                timeGrains: metadata.supportedTimeGrains,
                dimensions: metadata.dimensions,
                isLoading: false,
                supportedAggTypes: (_a = metadata.supportedAggTypes) !== null && _a !== void 0 ? _a : [],
                primaryAggType: metadata.primaryAggType,
            });
        });
    }, [datasource, subscription, resourceGroup, metricDefinition, resourceName, metricNamespace, metricName]);
    // Update the query state in response to the meta data changing
    useEffect(function () {
        var aggregationIsValid = aggregation && metricMetadata.supportedAggTypes.includes(aggregation);
        var newAggregation = aggregationIsValid ? aggregation : metricMetadata.primaryAggType;
        var newTimeGrain = timeGrain || 'auto';
        if (newAggregation !== aggregation || newTimeGrain !== timeGrain) {
            onChange(__assign(__assign({}, query), { azureMonitor: __assign(__assign({}, query.azureMonitor), { aggregation: newAggregation, timeGrain: newTimeGrain }) }));
        }
    }, [onChange, metricMetadata, aggregation, timeGrain, query]);
    return metricMetadata;
};
function isInvalidOption(value, options, templateVariables) {
    return value && !templateVariables.includes(value) && !hasOption(options, value);
}
//# sourceMappingURL=dataHooks.js.map