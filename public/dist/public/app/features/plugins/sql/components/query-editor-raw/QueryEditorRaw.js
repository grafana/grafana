import React, { useCallback, useEffect, useRef } from 'react';
import { SQLEditor } from '@grafana/experimental';
export function QueryEditorRaw({ children, onChange, query, width, height, editorLanguageDefinition }) {
    // We need to pass query via ref to SQLEditor as onChange is executed via monacoEditor.onDidChangeModelContent callback, not onChange property
    const queryRef = useRef(query);
    useEffect(() => {
        queryRef.current = query;
    }, [query]);
    const onRawQueryChange = useCallback((rawSql, processQuery) => {
        const newQuery = Object.assign(Object.assign({}, queryRef.current), { rawQuery: true, rawSql });
        onChange(newQuery, processQuery);
    }, [onChange]);
    return (React.createElement(SQLEditor, { width: width, height: height, query: query.rawSql, onChange: onRawQueryChange, language: editorLanguageDefinition }, children));
}
//# sourceMappingURL=QueryEditorRaw.js.map