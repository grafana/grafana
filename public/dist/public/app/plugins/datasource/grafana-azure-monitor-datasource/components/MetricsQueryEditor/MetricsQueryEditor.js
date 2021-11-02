import React from 'react';
import SubscriptionField from '../SubscriptionField';
import MetricNamespaceField from './MetricNamespaceField';
import ResourceTypeField from './ResourceTypeField';
import ResourceGroupsField from './ResourceGroupsField';
import ResourceNameField from './ResourceNameField';
import MetricNameField from './MetricNameField';
import AggregationField from './AggregationField';
import TimeGrainField from './TimeGrainField';
import DimensionFields from './DimensionFields';
import TopField from './TopField';
import LegendFormatField from './LegendFormatField';
import { InlineFieldRow } from '@grafana/ui';
import { useMetricNames, useMetricNamespaces, useResourceGroups, useResourceNames, useResourceTypes, useSubscriptions, useMetricMetadata, } from './dataHooks';
var MetricsQueryEditor = function (_a) {
    var _b, _c, _d;
    var query = _a.query, datasource = _a.datasource, subscriptionId = _a.subscriptionId, variableOptionGroup = _a.variableOptionGroup, onChange = _a.onChange, setError = _a.setError;
    var metricsMetadata = useMetricMetadata(query, datasource, onChange);
    var subscriptions = useSubscriptions(query, datasource, onChange, setError);
    var resourceGroups = useResourceGroups(query, datasource, onChange, setError);
    var resourceTypes = useResourceTypes(query, datasource, onChange, setError);
    var resourceNames = useResourceNames(query, datasource, onChange, setError);
    var metricNames = useMetricNames(query, datasource, onChange, setError);
    var metricNamespaces = useMetricNamespaces(query, datasource, onChange, setError);
    return (React.createElement("div", { "data-testid": "azure-monitor-metrics-query-editor" },
        React.createElement(InlineFieldRow, null,
            React.createElement(SubscriptionField, { subscriptions: subscriptions, query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError }),
            React.createElement(ResourceGroupsField, { resourceGroups: resourceGroups, query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError })),
        React.createElement(InlineFieldRow, null,
            React.createElement(ResourceTypeField, { resourceTypes: resourceTypes, query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError }),
            React.createElement(ResourceNameField, { resourceNames: resourceNames, query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError })),
        React.createElement(InlineFieldRow, null,
            React.createElement(MetricNamespaceField, { metricNamespaces: metricNamespaces, query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError }),
            React.createElement(MetricNameField, { metricNames: metricNames, query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError })),
        React.createElement(InlineFieldRow, null,
            React.createElement(AggregationField, { query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError, aggregationOptions: (_b = metricsMetadata === null || metricsMetadata === void 0 ? void 0 : metricsMetadata.aggOptions) !== null && _b !== void 0 ? _b : [], isLoading: metricsMetadata.isLoading }),
            React.createElement(TimeGrainField, { query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError, timeGrainOptions: (_c = metricsMetadata === null || metricsMetadata === void 0 ? void 0 : metricsMetadata.timeGrains) !== null && _c !== void 0 ? _c : [] })),
        React.createElement(DimensionFields, { query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError, dimensionOptions: (_d = metricsMetadata === null || metricsMetadata === void 0 ? void 0 : metricsMetadata.dimensions) !== null && _d !== void 0 ? _d : [] }),
        React.createElement(TopField, { query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError }),
        React.createElement(LegendFormatField, { query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError })));
};
export default MetricsQueryEditor;
//# sourceMappingURL=MetricsQueryEditor.js.map