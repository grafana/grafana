import React from 'react';
import PromQueryField from './PromQueryField';
export function PromQueryEditorForAlerting(props) {
    const { datasource, query, range, data, onChange, onRunQuery } = props;
    return (React.createElement(PromQueryField, { datasource: datasource, query: query, onRunQuery: onRunQuery, onChange: onChange, history: [], range: range, data: data, "data-testid": testIds.editor }));
}
export const testIds = {
    editor: 'prom-editor-cloud-alerting',
};
//# sourceMappingURL=PromQueryEditorForAlerting.js.map