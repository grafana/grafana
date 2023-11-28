import React from 'react';
import { EditorRows, EditorRow, EditorFieldGroup } from '@grafana/experimental';
import { multiResourceCompatibleTypes } from '../../azureMetadata';
import { selectors } from '../../e2e/selectors';
import ResourceField from '../ResourceField';
import { ResourceRowType } from '../ResourcePicker/types';
import { parseResourceDetails } from '../ResourcePicker/utils';
import AdvancedResourcePicker from './AdvancedResourcePicker';
import AggregationField from './AggregationField';
import DimensionFields from './DimensionFields';
import LegendFormatField from './LegendFormatField';
import MetricNameField from './MetricNameField';
import MetricNamespaceField from './MetricNamespaceField';
import TimeGrainField from './TimeGrainField';
import TopField from './TopField';
import { useMetricNames, useMetricNamespaces, useMetricMetadata } from './dataHooks';
const MetricsQueryEditor = ({ data, query, datasource, variableOptionGroup, onChange, setError, }) => {
    var _a, _b, _c, _d, _e, _f;
    const metricsMetadata = useMetricMetadata(query, datasource, onChange);
    const metricNamespaces = useMetricNamespaces(query, datasource, onChange, setError);
    const metricNames = useMetricNames(query, datasource, onChange, setError);
    const resources = (_c = (_b = (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.resources) === null || _b === void 0 ? void 0 : _b.map((r) => {
        var _a, _b;
        return ({
            subscription: query.subscription,
            resourceGroup: r.resourceGroup,
            metricNamespace: (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.metricNamespace,
            resourceName: r.resourceName,
            region: (_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.region,
        });
    })) !== null && _c !== void 0 ? _c : [];
    const supportMultipleResource = (namespace) => {
        var _a, _b;
        return (_b = multiResourceCompatibleTypes[(_a = namespace === null || namespace === void 0 ? void 0 : namespace.toLocaleLowerCase()) !== null && _a !== void 0 ? _a : '']) !== null && _b !== void 0 ? _b : false;
    };
    const disableRow = (row, selectedRows) => {
        var _a, _b;
        if (selectedRows.length === 0) {
            // Only if there is some resource(s) selected we should disable rows
            return false;
        }
        const rowResource = parseResourceDetails(row.uri, row.location);
        const selectedRowSample = parseResourceDetails(selectedRows[0].uri, selectedRows[0].location);
        // Only resources:
        // - in the same subscription
        // - in the same region
        // - with the same metric namespace
        // - with a metric namespace that is compatible with multi-resource queries
        return (rowResource.subscription !== selectedRowSample.subscription ||
            rowResource.region !== selectedRowSample.region ||
            ((_a = rowResource.metricNamespace) === null || _a === void 0 ? void 0 : _a.toLocaleLowerCase()) !== ((_b = selectedRowSample.metricNamespace) === null || _b === void 0 ? void 0 : _b.toLocaleLowerCase()) ||
            !supportMultipleResource(rowResource.metricNamespace));
    };
    const selectionNotice = (selectedRows) => {
        if (selectedRows.length === 0) {
            return '';
        }
        const selectedRowSample = parseResourceDetails(selectedRows[0].uri, selectedRows[0].location);
        return supportMultipleResource(selectedRowSample.metricNamespace)
            ? 'You can select items of the same resource type and location. To select resources of a different resource type or location, please first uncheck your current selection.'
            : '';
    };
    return (React.createElement("span", { "data-testid": selectors.components.queryEditor.metricsQueryEditor.container.input },
        React.createElement(EditorRows, null,
            React.createElement(EditorRow, null,
                React.createElement(EditorFieldGroup, null,
                    React.createElement(ResourceField, { query: query, datasource: datasource, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError, selectableEntryTypes: [ResourceRowType.Resource], resources: resources !== null && resources !== void 0 ? resources : [], queryType: 'metrics', disableRow: disableRow, renderAdvanced: (resources, onChange) => (
                        // It's required to cast resources because the resource picker
                        // specifies the type to string | AzureMonitorResource.
                        // eslint-disable-next-line
                        React.createElement(AdvancedResourcePicker, { resources: resources, onChange: onChange })), selectionNotice: selectionNotice }),
                    React.createElement(MetricNamespaceField, { metricNamespaces: metricNamespaces, query: query, datasource: datasource, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError }),
                    React.createElement(MetricNameField, { metricNames: metricNames, query: query, datasource: datasource, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError }),
                    React.createElement(AggregationField, { query: query, datasource: datasource, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError, aggregationOptions: (_d = metricsMetadata === null || metricsMetadata === void 0 ? void 0 : metricsMetadata.aggOptions) !== null && _d !== void 0 ? _d : [], isLoading: metricsMetadata.isLoading }),
                    React.createElement(TimeGrainField, { query: query, datasource: datasource, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError, timeGrainOptions: (_e = metricsMetadata === null || metricsMetadata === void 0 ? void 0 : metricsMetadata.timeGrains) !== null && _e !== void 0 ? _e : [] }))),
            React.createElement(EditorRow, null,
                React.createElement(EditorFieldGroup, null,
                    React.createElement(DimensionFields, { data: data, query: query, datasource: datasource, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError, dimensionOptions: (_f = metricsMetadata === null || metricsMetadata === void 0 ? void 0 : metricsMetadata.dimensions) !== null && _f !== void 0 ? _f : [] }))),
            React.createElement(EditorRow, null,
                React.createElement(EditorFieldGroup, null,
                    React.createElement(TopField, { query: query, datasource: datasource, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError }),
                    React.createElement(LegendFormatField, { query: query, datasource: datasource, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError }))))));
};
export default MetricsQueryEditor;
//# sourceMappingURL=MetricsQueryEditor.js.map