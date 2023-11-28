import React, { useId } from 'react';
import { HorizontalGroup, InlineFormLabel, Input, Select, TextArea } from '@grafana/ui';
import { DEFAULT_RESULT_FORMAT, RESULT_FORMATS } from '../../../constants';
import { useShadowedState } from '../hooks/useShadowedState';
// we handle 3 fields: "query", "alias", "resultFormat"
// "resultFormat" changes are applied immediately
// "query" and "alias" changes only happen on onblur
export const RawInfluxQLEditor = ({ query, onChange, onRunQuery }) => {
    var _a;
    const [currentQuery, setCurrentQuery] = useShadowedState(query.query);
    const [currentAlias, setCurrentAlias] = useShadowedState(query.alias);
    const aliasElementId = useId();
    const selectElementId = useId();
    const resultFormat = (_a = query.resultFormat) !== null && _a !== void 0 ? _a : DEFAULT_RESULT_FORMAT;
    const applyDelayedChangesAndRunQuery = () => {
        onChange(Object.assign(Object.assign({}, query), { query: currentQuery, alias: currentAlias, resultFormat }));
        onRunQuery();
    };
    return (React.createElement("div", null,
        React.createElement(TextArea, { "aria-label": "query", rows: 3, spellCheck: false, placeholder: "InfluxDB Query", onBlur: applyDelayedChangesAndRunQuery, onChange: (e) => {
                setCurrentQuery(e.currentTarget.value);
            }, value: currentQuery !== null && currentQuery !== void 0 ? currentQuery : '' }),
        React.createElement(HorizontalGroup, null,
            React.createElement(InlineFormLabel, { htmlFor: selectElementId }, "Format as"),
            React.createElement(Select, { inputId: selectElementId, onChange: (v) => {
                    onChange(Object.assign(Object.assign({}, query), { resultFormat: v.value }));
                    onRunQuery();
                }, value: resultFormat, options: RESULT_FORMATS }),
            React.createElement(InlineFormLabel, { htmlFor: aliasElementId }, "Alias by"),
            React.createElement(Input, { id: aliasElementId, type: "text", spellCheck: false, placeholder: "Naming pattern", onBlur: applyDelayedChangesAndRunQuery, onChange: (e) => {
                    setCurrentAlias(e.currentTarget.value);
                }, value: currentAlias !== null && currentAlias !== void 0 ? currentAlias : '' }))));
};
//# sourceMappingURL=RawInfluxQLEditor.js.map