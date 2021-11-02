import React from 'react';
import { LokiQueryField } from './LokiQueryField';
export function LokiQueryEditorForAlerting(props) {
    var query = props.query, data = props.data, datasource = props.datasource, onChange = props.onChange, onRunQuery = props.onRunQuery;
    return (React.createElement(LokiQueryField, { datasource: datasource, query: query, onChange: onChange, onRunQuery: onRunQuery, onBlur: onRunQuery, history: [], data: data, placeholder: "Enter a Loki query", "data-testid": testIds.editor }));
}
export var testIds = {
    editor: 'loki-editor-cloud-alerting',
};
//# sourceMappingURL=LokiQueryEditorForAlerting.js.map