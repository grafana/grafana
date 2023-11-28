import React, { useCallback, useEffect, useState } from 'react';
import { usePrevious } from 'react-use';
import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/experimental';
import { Input } from '@grafana/ui';
import { selectors } from '../../e2e/selectors';
import { ResultFormat } from '../../types';
import { Field } from '../Field';
import FormatAsField from '../FormatAsField';
import AdvancedResourcePicker from '../LogsQueryEditor/AdvancedResourcePicker';
import ResourceField from '../ResourceField';
import { ResourceRowType } from '../ResourcePicker/types';
import { parseResourceDetails } from '../ResourcePicker/utils';
import Filters from './Filters';
import TraceTypeField from './TraceTypeField';
import { setFormatAs, setQueryOperationId } from './setQueryValue';
const TracesQueryEditor = ({ query, datasource, subscriptionId, variableOptionGroup, onChange, setError, range, }) => {
    var _a, _b, _c, _d, _e, _f;
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
    const [operationId, setOperationId] = useState((_b = (_a = query.azureTraces) === null || _a === void 0 ? void 0 : _a.operationId) !== null && _b !== void 0 ? _b : '');
    const previousOperationId = usePrevious((_c = query.azureTraces) === null || _c === void 0 ? void 0 : _c.operationId);
    useEffect(() => {
        var _a;
        if ((_a = query.azureTraces) === null || _a === void 0 ? void 0 : _a.operationId) {
            if (previousOperationId !== query.azureTraces.operationId) {
                setOperationId(query.azureTraces.operationId);
            }
        }
    }, [setOperationId, previousOperationId, query, operationId]);
    const handleChange = useCallback((ev) => {
        if (ev.target instanceof HTMLInputElement) {
            setOperationId(ev.target.value);
        }
    }, []);
    const handleBlur = useCallback((ev) => {
        const newQuery = setQueryOperationId(query, operationId);
        onChange(newQuery);
    }, [onChange, operationId, query]);
    return (React.createElement("span", { "data-testid": selectors.components.queryEditor.tracesQueryEditor.container.input },
        React.createElement(EditorRows, null,
            React.createElement(EditorRow, null,
                React.createElement(EditorFieldGroup, null,
                    React.createElement(ResourceField, { query: query, datasource: datasource, subscriptionId: subscriptionId, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, setError: setError, selectableEntryTypes: [
                            ResourceRowType.Subscription,
                            ResourceRowType.ResourceGroup,
                            ResourceRowType.Resource,
                            ResourceRowType.Variable,
                        ], resources: (_e = (_d = query.azureTraces) === null || _d === void 0 ? void 0 : _d.resources) !== null && _e !== void 0 ? _e : [], queryType: "traces", disableRow: disableRow, renderAdvanced: (resources, onChange) => (
                        // It's required to cast resources because the resource picker
                        // specifies the type to string | AzureMonitorResource.
                        // eslint-disable-next-line
                        React.createElement(AdvancedResourcePicker, { resources: resources, onChange: onChange })), selectionNotice: () => 'You may only choose items of the same resource type.', range: range }))),
            React.createElement(EditorRow, null,
                React.createElement(EditorFieldGroup, null,
                    React.createElement(TraceTypeField, { datasource: datasource, onQueryChange: onChange, query: query, setError: setError, variableOptionGroup: variableOptionGroup, range: range }),
                    React.createElement(Field, { label: "Operation ID" },
                        React.createElement(Input, { id: "azure-monitor-traces-operation-id-field", value: operationId, onChange: handleChange, onBlur: handleBlur, width: 40 })))),
            React.createElement(EditorRow, null,
                React.createElement(EditorFieldGroup, null,
                    React.createElement(Filters, { datasource: datasource, onQueryChange: onChange, query: query, setError: setError, variableOptionGroup: variableOptionGroup, range: range }))),
            React.createElement(EditorRow, null,
                React.createElement(EditorFieldGroup, null,
                    React.createElement(FormatAsField, { datasource: datasource, setError: setError, query: query, variableOptionGroup: variableOptionGroup, onQueryChange: onChange, inputId: "azure-monitor-traces", options: [
                            { label: 'Table', value: ResultFormat.Table },
                            { label: 'Trace', value: ResultFormat.Trace },
                        ], defaultValue: ResultFormat.Table, setFormatAs: setFormatAs, resultFormat: (_f = query.azureTraces) === null || _f === void 0 ? void 0 : _f.resultFormat, range: range }))))));
};
export default TracesQueryEditor;
//# sourceMappingURL=TracesQueryEditor.js.map