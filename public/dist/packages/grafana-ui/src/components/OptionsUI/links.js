import React from 'react';
import { VariableSuggestionsScope, } from '@grafana/data';
import { DataLinksInlineEditor } from '../DataLinks/DataLinksInlineEditor/DataLinksInlineEditor';
export var DataLinksValueEditor = function (_a) {
    var value = _a.value, onChange = _a.onChange, context = _a.context;
    return (React.createElement(DataLinksInlineEditor, { links: value, onChange: onChange, data: context.data, getSuggestions: function () { return (context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : []); } }));
};
//# sourceMappingURL=links.js.map