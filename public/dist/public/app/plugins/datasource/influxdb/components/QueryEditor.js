import { __assign } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { FluxQueryEditor } from './FluxQueryEditor';
import { RawInfluxQLEditor } from './RawInfluxQLEditor';
import { Editor as VisualInfluxQLEditor } from './VisualInfluxQLEditor/Editor';
import { QueryEditorModeSwitcher } from './QueryEditorModeSwitcher';
import { buildRawQuery } from '../queryUtils';
export var QueryEditor = function (_a) {
    var _b;
    var query = _a.query, onChange = _a.onChange, onRunQuery = _a.onRunQuery, datasource = _a.datasource, range = _a.range, data = _a.data;
    if (datasource.isFlux) {
        return (React.createElement("div", { className: "gf-form-query-content" },
            React.createElement(FluxQueryEditor, { query: query, onChange: onChange, onRunQuery: onRunQuery, datasource: datasource })));
    }
    return (React.createElement("div", { className: css({ display: 'flex' }) },
        React.createElement("div", { className: css({ flexGrow: 1 }) }, query.rawQuery ? (React.createElement(RawInfluxQLEditor, { query: query, onChange: onChange, onRunQuery: onRunQuery })) : (React.createElement(VisualInfluxQLEditor, { query: query, onChange: onChange, onRunQuery: onRunQuery, datasource: datasource }))),
        React.createElement(QueryEditorModeSwitcher, { isRaw: (_b = query.rawQuery) !== null && _b !== void 0 ? _b : false, onChange: function (value) {
                onChange(__assign(__assign({}, query), { query: buildRawQuery(query), rawQuery: value }));
                onRunQuery();
            } })));
};
//# sourceMappingURL=QueryEditor.js.map