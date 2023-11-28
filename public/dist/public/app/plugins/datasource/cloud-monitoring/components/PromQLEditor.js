import React from 'react';
import { EditorField, EditorRow } from '@grafana/experimental';
import { TextArea, Input } from '@grafana/ui';
import { Project } from './Project';
export const defaultQuery = (dataSource) => ({
    projectName: dataSource.getDefaultProject(),
    expr: '',
    step: '10s',
});
export function PromQLQueryEditor({ refId, query, datasource, onChange, variableOptionGroup, onRunQuery, }) {
    var _a;
    function onReturnKeyDown(e) {
        if (e.key === 'Enter' && e.shiftKey) {
            onRunQuery();
            e.preventDefault();
            e.stopPropagation();
        }
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(EditorRow, null,
            React.createElement(Project, { refId: refId, templateVariableOptions: variableOptionGroup.options, projectName: query.projectName, datasource: datasource, onChange: (projectName) => onChange(Object.assign(Object.assign({}, query), { projectName })) }),
            React.createElement(TextArea, { name: "Query", className: "slate-query-field", value: query.expr, rows: 10, placeholder: "Enter a Cloud Monitoring Prometheus query (Run with Shift+Enter)", onBlur: onRunQuery, onKeyDown: onReturnKeyDown, onChange: (e) => onChange(Object.assign(Object.assign({}, query), { expr: e.currentTarget.value })) }),
            React.createElement(EditorField, { label: "Min step", tooltip: 'Time units and built-in variables can be used here, for example: $__interval, $__rate_interval, 5s, 1m, 3h, 1d, 1y (Default if no unit is specified: 10s)' },
                React.createElement(Input, { type: 'string', placeholder: 'auto', onChange: (e) => onChange(Object.assign(Object.assign({}, query), { step: e.currentTarget.value })), onKeyDown: onReturnKeyDown, value: (_a = query.step) !== null && _a !== void 0 ? _a : '' })))));
}
//# sourceMappingURL=PromQLEditor.js.map