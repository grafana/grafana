import React from 'react';
import { CodeEditor } from '@grafana/ui';
export const CSVContentEditor = ({ onChange, query }) => {
    var _a;
    const onSaveCSV = (csvContent) => {
        onChange(Object.assign(Object.assign({}, query), { csvContent }));
    };
    return (React.createElement(CodeEditor, { height: 300, language: "csv", value: (_a = query.csvContent) !== null && _a !== void 0 ? _a : '', onBlur: onSaveCSV, onSave: onSaveCSV, showMiniMap: false, showLineNumbers: true }));
};
//# sourceMappingURL=CSVContentEditor.js.map