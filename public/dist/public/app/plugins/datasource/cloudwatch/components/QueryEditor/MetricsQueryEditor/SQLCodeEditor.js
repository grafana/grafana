import React, { useCallback, useEffect } from 'react';
import { CodeEditor } from '@grafana/ui';
import language from '../../../language/cloudwatch-sql/definition';
import { TRIGGER_SUGGEST } from '../../../language/monarch/commands';
import { registerLanguage } from '../../../language/monarch/register';
export const SQLCodeEditor = ({ region, sql, onChange, datasource }) => {
    useEffect(() => {
        datasource.sqlCompletionItemProvider.setRegion(region);
    }, [region, datasource]);
    const onEditorMount = useCallback((editor, monaco) => {
        editor.onDidFocusEditorText(() => editor.trigger(TRIGGER_SUGGEST.id, TRIGGER_SUGGEST.id, {}));
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
            const text = editor.getValue();
            onChange(text);
        });
    }, [onChange]);
    return (React.createElement(CodeEditor, { height: '150px', language: language.id, value: sql, onBlur: (value) => {
            if (value !== sql) {
                onChange(value);
            }
        }, showMiniMap: false, showLineNumbers: true, onBeforeEditorMount: (monaco) => registerLanguage(monaco, language, datasource.sqlCompletionItemProvider), onEditorDidMount: onEditorMount }));
};
//# sourceMappingURL=SQLCodeEditor.js.map