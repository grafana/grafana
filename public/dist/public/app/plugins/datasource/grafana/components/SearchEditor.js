import React, { useEffect, useState } from 'react';
import { InlineField, Input, InlineFieldRow, CodeEditor } from '@grafana/ui';
export default function SearchEditor({ value, onChange }) {
    var _a;
    const [json, setJSON] = useState('');
    const [query, setQuery] = useState((_a = value.query) !== null && _a !== void 0 ? _a : '');
    useEffect(() => {
        const emptySearchQuery = {
            query: '*',
            location: '',
            ds_uid: '',
            sort: '',
            tags: [],
            kind: [],
            explain: false,
            facet: [{ field: 'kind' }, { field: 'tags' }],
            from: 0,
            limit: 20,
        };
        setJSON(JSON.stringify(Object.assign(Object.assign({}, emptySearchQuery), value), null, 2));
    }, [value]);
    const handleSearchBlur = (e) => {
        if (query !== value.query) {
            onChange(Object.assign(Object.assign({}, value), { query }));
        }
    };
    const handleSearchEnterKey = (e) => {
        if (e.key !== 'Enter') {
            return;
        }
        handleSearchBlur(e);
    };
    const onSaveSearchJSON = (rawSearchJSON) => {
        var _a;
        try {
            const searchQuery = JSON.parse(rawSearchJSON);
            onChange(searchQuery);
            setQuery((_a = searchQuery.query) !== null && _a !== void 0 ? _a : '');
        }
        catch (ex) {
            console.log('UNABLE TO parse search', rawSearchJSON, ex);
        }
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Query", grow: true, labelWidth: 12 },
                React.createElement(Input, { placeholder: "Everything", value: query, onChange: (e) => setQuery(e.currentTarget.value), onKeyDown: handleSearchEnterKey, onBlur: handleSearchBlur, spellCheck: false }))),
        React.createElement(CodeEditor, { height: 300, language: "json", value: json, onBlur: onSaveSearchJSON, onSave: onSaveSearchJSON, showMiniMap: false, showLineNumbers: true })));
}
//# sourceMappingURL=SearchEditor.js.map