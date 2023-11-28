import React, { useCallback } from 'react';
import { CodeEditor } from '@grafana/ui';
const QueryField = ({ query, onQueryChange }) => {
    var _a, _b;
    const onChange = useCallback((newQuery) => {
        onQueryChange(Object.assign(Object.assign({}, query), { azureResourceGraph: Object.assign(Object.assign({}, query.azureResourceGraph), { query: newQuery }) }));
    }, [onQueryChange, query]);
    return (React.createElement(CodeEditor, { value: (_b = (_a = query.azureResourceGraph) === null || _a === void 0 ? void 0 : _a.query) !== null && _b !== void 0 ? _b : '', language: "kusto", height: 200, width: "100%", showMiniMap: false, onBlur: onChange, onSave: onChange }));
};
export default QueryField;
//# sourceMappingURL=QueryField.js.map