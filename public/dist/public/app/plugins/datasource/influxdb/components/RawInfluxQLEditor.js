import { __assign, __read } from "tslib";
import React from 'react';
import { TextArea, InlineFormLabel, Input, Select, HorizontalGroup } from '@grafana/ui';
import { useShadowedState } from './useShadowedState';
import { useUniqueId } from './useUniqueId';
import { RESULT_FORMATS, DEFAULT_RESULT_FORMAT } from './constants';
// we handle 3 fields: "query", "alias", "resultFormat"
// "resultFormat" changes are applied immediately
// "query" and "alias" changes only happen on onblur
export var RawInfluxQLEditor = function (_a) {
    var _b;
    var query = _a.query, onChange = _a.onChange, onRunQuery = _a.onRunQuery;
    var _c = __read(useShadowedState(query.query), 2), currentQuery = _c[0], setCurrentQuery = _c[1];
    var _d = __read(useShadowedState(query.alias), 2), currentAlias = _d[0], setCurrentAlias = _d[1];
    var aliasElementId = useUniqueId();
    var selectElementId = useUniqueId();
    var resultFormat = (_b = query.resultFormat) !== null && _b !== void 0 ? _b : DEFAULT_RESULT_FORMAT;
    var applyDelayedChangesAndRunQuery = function () {
        onChange(__assign(__assign({}, query), { query: currentQuery, alias: currentAlias, resultFormat: resultFormat }));
        onRunQuery();
    };
    return (React.createElement("div", null,
        React.createElement(TextArea, { "aria-label": "query", rows: 3, spellCheck: false, placeholder: "InfluxDB Query", onBlur: applyDelayedChangesAndRunQuery, onChange: function (e) {
                setCurrentQuery(e.currentTarget.value);
            }, value: currentQuery !== null && currentQuery !== void 0 ? currentQuery : '' }),
        React.createElement(HorizontalGroup, null,
            React.createElement(InlineFormLabel, { htmlFor: selectElementId }, "Format as"),
            React.createElement(Select, { menuShouldPortal: true, inputId: selectElementId, onChange: function (v) {
                    onChange(__assign(__assign({}, query), { resultFormat: v.value }));
                    onRunQuery();
                }, value: resultFormat, options: RESULT_FORMATS }),
            React.createElement(InlineFormLabel, { htmlFor: aliasElementId }, "Alias by"),
            React.createElement(Input, { id: aliasElementId, type: "text", spellCheck: false, placeholder: "Naming pattern", onBlur: applyDelayedChangesAndRunQuery, onChange: function (e) {
                    setCurrentAlias(e.currentTarget.value);
                }, value: currentAlias !== null && currentAlias !== void 0 ? currentAlias : '' }))));
};
//# sourceMappingURL=RawInfluxQLEditor.js.map