import { __awaiter } from "tslib";
import { useEffect, useState } from 'react';
import { rangeUtil } from '@grafana/data';
import TimegrainConverter from '../../time_grain_converter';
import { toOption } from '../../utils/common';
import { useAsyncState } from '../../utils/useAsyncState';
import { setCustomNamespace } from './setQueryValue';
const getResourceGroupAndName = (resources) => {
    var _a, _b;
    if (!resources || !resources.length) {
        return { resourceGroup: '', resourceName: '' };
    }
    return {
        resourceGroup: (_a = resources[0].resourceGroup) !== null && _a !== void 0 ? _a : '',
        resourceName: (_b = resources[0].resourceName) !== null && _b !== void 0 ? _b : '',
    };
};
export const useMetricNamespaces = (query, datasource, onChange, setError) => {
    var _a;
    const { subscription } = query;
    const { metricNamespace, resources } = (_a = query.azureMonitor) !== null && _a !== void 0 ? _a : {};
    const { resourceGroup, resourceName } = getResourceGroupAndName(resources);
    const metricNamespaces = useAsyncState(() => __awaiter(void 0, void 0, void 0, function* () {
        if (!subscription || !resourceGroup || !resourceName) {
            return;
        }
        const results = yield datasource.azureMonitorDatasource.getMetricNamespaces({
            subscription,
            metricNamespace,
            resourceGroup,
            resourceName,
        }, false);
        const options = formatOptions(results, metricNamespace);
        // Do some cleanup of the query state if need be
        if (!metricNamespace && options.length) {
            onChange(setCustomNamespace(query, options[0].value));
        }
        return options;
    }), setError, [subscription, metricNamespace, resourceGroup, resourceName]);
    return metricNamespaces;
};
export const useMetricNames = (query, datasource, onChange, setError) => {
    var _a, _b, _c, _d;
    const { subscription } = query;
    const { metricNamespace, metricName, resources, customNamespace } = (_a = query.azureMonitor) !== null && _a !== void 0 ? _a : {};
    const { resourceGroup, resourceName } = getResourceGroupAndName(resources);
    const multipleResources = (_b = (resources && resources.length > 1)) !== null && _b !== void 0 ? _b : false;
    const region = (_d = (_c = query.azureMonitor) === null || _c === void 0 ? void 0 : _c.region) !== null && _d !== void 0 ? _d : '';
    return useAsyncState(() => __awaiter(void 0, void 0, void 0, function* () {
        if (!subscription || !metricNamespace || !resourceGroup || !resourceName) {
            return;
        }
        const results = yield datasource.azureMonitorDatasource.getMetricNames({
            subscription,
            resourceGroup,
            resourceName,
            metricNamespace,
            customNamespace,
        }, multipleResources, region);
        const options = formatOptions(results, metricName);
        return options;
    }), setError, [subscription, resourceGroup, resourceName, metricNamespace, customNamespace, multipleResources]);
};
const defaultMetricMetadata = {
    aggOptions: [],
    timeGrains: [],
    dimensions: [],
    isLoading: false,
    supportedAggTypes: [],
    primaryAggType: undefined,
};
export const useMetricMetadata = (query, datasource, onChange) => {
    var _a, _b;
    const [metricMetadata, setMetricMetadata] = useState(defaultMetricMetadata);
    const { subscription } = query;
    const { resources, metricNamespace, metricName, aggregation, timeGrain, customNamespace, region } = (_a = query.azureMonitor) !== null && _a !== void 0 ? _a : {};
    const { resourceGroup, resourceName } = getResourceGroupAndName(resources);
    const multipleResources = (_b = (resources && resources.length > 1)) !== null && _b !== void 0 ? _b : false;
    // Fetch new metric metadata when the fields change
    useEffect(() => {
        if (!subscription || !resourceGroup || !resourceName || !metricNamespace || !metricName) {
            setMetricMetadata(defaultMetricMetadata);
            return;
        }
        datasource.azureMonitorDatasource
            .getMetricMetadata({ subscription, resourceGroup, resourceName, metricNamespace, metricName, customNamespace }, multipleResources, region)
            .then((metadata) => {
            var _a;
            // TODO: Move the aggregationTypes and timeGrain defaults into `getMetricMetadata`
            const aggregations = (metadata.supportedAggTypes || [metadata.primaryAggType]).map((v) => ({
                label: v,
                value: v,
            }));
            setMetricMetadata({
                aggOptions: aggregations,
                timeGrains: metadata.supportedTimeGrains,
                dimensions: metadata.dimensions,
                isLoading: false,
                supportedAggTypes: (_a = metadata.supportedAggTypes) !== null && _a !== void 0 ? _a : [],
                primaryAggType: metadata.primaryAggType,
            });
        });
    }, [
        region,
        datasource,
        subscription,
        resourceGroup,
        resourceName,
        metricNamespace,
        metricName,
        customNamespace,
        multipleResources,
    ]);
    // Update the query state in response to the meta data changing
    useEffect(() => {
        const newAggregation = aggregation || metricMetadata.primaryAggType;
        const newTimeGrain = timeGrain || 'auto';
        if (newAggregation !== aggregation || newTimeGrain !== timeGrain) {
            onChange(Object.assign(Object.assign({}, query), { azureMonitor: Object.assign(Object.assign({}, query.azureMonitor), { aggregation: newAggregation, timeGrain: newTimeGrain, allowedTimeGrainsMs: metricMetadata.timeGrains
                        .filter((timeGrain) => timeGrain.value !== 'auto')
                        .map((timeGrain) => rangeUtil.intervalToMs(TimegrainConverter.createKbnUnitFromISO8601Duration(timeGrain.value))) }) }));
        }
    }, [onChange, metricMetadata, aggregation, timeGrain, query]);
    return metricMetadata;
};
function formatOptions(rawResults, selectedValue) {
    const options = rawResults.map(toOption);
    // account for custom values that might have been set in json file like ones crafted with a template variable (ex: "cloud-datasource-resource-$Environment")
    if (selectedValue && !options.find((option) => option.value === selectedValue.toLowerCase())) {
        options.push({ label: selectedValue, value: selectedValue });
    }
    return options;
}
//# sourceMappingURL=dataHooks.js.map