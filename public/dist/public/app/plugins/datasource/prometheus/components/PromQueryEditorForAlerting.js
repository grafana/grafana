import React from 'react';
import PromQueryField from './PromQueryField';
export function PromQueryEditorForAlerting(props) {
    var datasource = props.datasource, query = props.query, range = props.range, data = props.data, onChange = props.onChange, onRunQuery = props.onRunQuery;
    return (React.createElement(PromQueryField, { datasource: datasource, query: query, onRunQuery: onRunQuery, onChange: onChange, history: [], range: range, data: data, placeholder: "Enter a PromQL query", "data-testid": testIds.editor }));
}
export var testIds = {
    editor: 'prom-editor-cloud-alerting',
};
//# sourceMappingURL=PromQueryEditorForAlerting.js.map