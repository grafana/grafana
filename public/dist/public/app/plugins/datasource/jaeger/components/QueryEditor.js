import { __assign } from "tslib";
import { css } from '@emotion/css';
import { FileDropzone, InlineField, InlineFieldRow, QueryField, RadioButtonGroup, useTheme2 } from '@grafana/ui';
import React from 'react';
import { SearchForm } from './SearchForm';
export function QueryEditor(_a) {
    var datasource = _a.datasource, query = _a.query, onChange = _a.onChange, onRunQuery = _a.onRunQuery;
    var theme = useTheme2();
    var onChangeQuery = function (value) {
        var nextQuery = __assign(__assign({}, query), { query: value });
        onChange(nextQuery);
    };
    var renderEditorBody = function () {
        switch (query.queryType) {
            case 'search':
                return React.createElement(SearchForm, { datasource: datasource, query: query, onChange: onChange });
            case 'upload':
                return (React.createElement("div", { className: css({ padding: theme.spacing(2) }) },
                    React.createElement(FileDropzone, { options: { multiple: false }, onLoad: function (result) {
                            datasource.uploadedJson = result;
                            onRunQuery();
                        } })));
            default:
                return (React.createElement(InlineFieldRow, null,
                    React.createElement(InlineField, { label: "Trace ID", labelWidth: 14, grow: true },
                        React.createElement(QueryField, { query: query.query, onChange: onChangeQuery, onRunQuery: onRunQuery, onBlur: function () { }, placeholder: 'Enter a Trace ID (run with Shift+Enter)', portalOrigin: "jaeger" }))));
        }
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: css({ width: '100%' }) },
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Query type" },
                    React.createElement(RadioButtonGroup, { options: [
                            { value: 'search', label: 'Search' },
                            { value: undefined, label: 'TraceID' },
                            { value: 'upload', label: 'JSON file' },
                        ], value: query.queryType, onChange: function (v) {
                            return onChange(__assign(__assign({}, query), { queryType: v }));
                        }, size: "md" }))),
            renderEditorBody())));
}
//# sourceMappingURL=QueryEditor.js.map