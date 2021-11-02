import { __assign } from "tslib";
import { CodeEditor } from '@grafana/ui';
import React, { useCallback } from 'react';
var QueryField = function (_a) {
    var _b, _c;
    var query = _a.query, onQueryChange = _a.onQueryChange;
    var onChange = useCallback(function (newQuery) {
        onQueryChange(__assign(__assign({}, query), { azureResourceGraph: __assign(__assign({}, query.azureResourceGraph), { query: newQuery }) }));
    }, [onQueryChange, query]);
    return (React.createElement(CodeEditor, { value: (_c = (_b = query.azureResourceGraph) === null || _b === void 0 ? void 0 : _b.query) !== null && _c !== void 0 ? _c : '', language: "kusto", height: 200, width: 1000, showMiniMap: false, onBlur: onChange, onSave: onChange }));
};
export default QueryField;
//# sourceMappingURL=QueryField.js.map