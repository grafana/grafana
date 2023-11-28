import React from 'react';
import { TextArea } from '@grafana/ui';
export function MQLQueryEditor({ query, onChange, onRunQuery }) {
    const onKeyDown = (event) => {
        if (event.key === 'Enter' && (event.shiftKey || event.ctrlKey)) {
            event.preventDefault();
            onRunQuery();
        }
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(TextArea, { name: "Query", className: "slate-query-field", value: query, rows: 10, placeholder: "Enter a Cloud Monitoring MQL query (Run with Shift+Enter)", onBlur: onRunQuery, onChange: (e) => onChange(e.currentTarget.value), onKeyDown: onKeyDown })));
}
//# sourceMappingURL=MQLQueryEditor.js.map