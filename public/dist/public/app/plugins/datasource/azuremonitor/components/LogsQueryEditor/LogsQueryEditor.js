import React, { useEffect, useState } from 'react';
import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/experimental';
import { Alert } from '@grafana/ui';
import { selectors } from '../../e2e/selectors';
import { ResultFormat } from '../../types';
import FormatAsField from '../FormatAsField';
import ResourceField from '../ResourceField';
import { ResourceRowType } from '../ResourcePicker/types';
import { parseResourceDetails } from '../ResourcePicker/utils';
import AdvancedResourcePicker from './AdvancedResourcePicker';
import QueryField from './QueryField';
import { TimeManagement } from './TimeManagement';
import { setFormatAs } from './setQueryValue';
import useMigrations from './useMigrations';
const LogsQueryEditor = ({ query, datasource, subscriptionId, variableOptionGroup, onChange, setError, hideFormatAs, }) => {
    var _a, _b, _c, _d;
    const migrationError = useMigrations(datasource, query, onChange);
    const disableRow = (row, selectedRows) => {
        var _a, _b;
        if (selectedRows.length === 0) {
            // Only if there is some resource(s) selected we should disable rows
            return false;
        }
        const rowResourceNS = (_a = parseResourceDetails(row.uri, row.location).metricNamespace) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        const selectedRowSampleNs = (_b = parseResourceDetails(selectedRows[0].uri, selectedRows[0].location).metricNamespace) === null || _b === void 0 ? void 0 : _b.toLowerCase();
        // Only resources with the same metricNamespace can be selected
        return rowResourceNS !== selectedRowSampleNs;
    };
    const [schema, setSchema] = useState();
    useEffect(() => {
        var _a;
        if (((_a = query.azureLogAnalytics) === null || _a === void 0 ? void 0 : _a.resources) && query.azureLogAnalytics.resources.length) {
            datasource.azureLogAnalyticsDatasource.getKustoSchema(query.azureLogAnalytics.resources[0]).then((schema) => {
                setSchema(schema);
            });
        }
    }, [(_a = query.azureLogAnalytics) === null || _a === void 0 ? void 0 : _a.resources, datasource.azureLogAnalyticsDatasource]);
    return (React.createElement("span", { "data-testid": selectors.components.queryEditor.logsQueryEditor.container.input },
        React.createElement(EditorRows, null,
            React.createElement(EditorRow, null,
                React.createElement(EditorFieldGroup, null,
                    React.createElement(ResourceField, { query: query, datasource: datasource, inlineField: true, labelWidth: 10, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError, selectableEntryTypes: [
                            ResourceRowType.Subscription,
                            ResourceRowType.ResourceGroup,
                            ResourceRowType.Resource,
                            ResourceRowType.Variable,
                        ], resources: (_c = (_b = query.azureLogAnalytics) === null || _b === void 0 ? void 0 : _b.resources) !== null && _c !== void 0 ? _c : [], queryType: "logs", disableRow: disableRow, renderAdvanced: (resources, onChange) => (
                        // It's required to cast resources because the resource picker
                        // specifies the type to string | AzureMonitorResource.
                        // eslint-disable-next-line
                        React.createElement(AdvancedResourcePicker, { resources: resources, onChange: onChange })), selectionNotice: () => 'You may only choose items of the same resource type.' }),
                    React.createElement(TimeManagement, { query: query, datasource: datasource, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError, schema: schema }))),
            React.createElement(QueryField, { query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError, schema: schema }),
            React.createElement(EditorRow, null,
                React.createElement(EditorFieldGroup, null,
                    !hideFormatAs && (React.createElement(FormatAsField, { query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError, inputId: 'azure-monitor-logs', options: [
                            { label: 'Time series', value: ResultFormat.TimeSeries },
                            { label: 'Table', value: ResultFormat.Table },
                        ], defaultValue: ResultFormat.Table, setFormatAs: setFormatAs, resultFormat: (_d = query.azureLogAnalytics) === null || _d === void 0 ? void 0 : _d.resultFormat })),
                    migrationError && React.createElement(Alert, { title: migrationError.title }, migrationError.message))))));
};
export default LogsQueryEditor;
//# sourceMappingURL=LogsQueryEditor.js.map