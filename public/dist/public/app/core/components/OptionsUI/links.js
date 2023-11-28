import React from 'react';
import { VariableSuggestionsScope, } from '@grafana/data';
import { DataLinksInlineEditor } from '@grafana/ui';
export const DataLinksValueEditor = ({ value, onChange, context }) => {
    return (React.createElement(DataLinksInlineEditor, { links: value, onChange: onChange, data: context.data, getSuggestions: () => (context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : []) }));
};
//# sourceMappingURL=links.js.map