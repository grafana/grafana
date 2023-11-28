import React, { useEffect, useRef } from 'react';
import { CodeEditor } from '@grafana/ui';
import { registerGoTemplateAutocomplete } from './editor/autocomplete';
import goTemplateLanguageDefinition, { GO_TEMPLATE_LANGUAGE_ID } from './editor/definition';
import { registerLanguage } from './editor/register';
const TemplateEditor = (props) => {
    const shouldAutoHeight = Boolean(props.autoHeight);
    const disposeSuggestions = useRef(null);
    const onEditorDidMount = (editor) => {
        if (shouldAutoHeight) {
            const contentHeight = editor.getContentHeight();
            try {
                // we're passing NaN in to the width because the type definition wants a number (NaN is a number, go figure)
                // but the width could be defined as a string "auto", passing NaN seems to just ignore our width update here
                editor.layout({ height: contentHeight, width: NaN });
            }
            catch (err) { }
        }
    };
    useEffect(() => {
        return () => {
            var _a;
            (_a = disposeSuggestions.current) === null || _a === void 0 ? void 0 : _a.dispose();
        };
    }, []);
    return (React.createElement(CodeEditor, Object.assign({ showLineNumbers: true, showMiniMap: false }, props, { onEditorDidMount: onEditorDidMount, onBeforeEditorMount: (monaco) => {
            registerLanguage(monaco, goTemplateLanguageDefinition);
            disposeSuggestions.current = registerGoTemplateAutocomplete(monaco);
        }, language: GO_TEMPLATE_LANGUAGE_ID })));
};
export { TemplateEditor };
//# sourceMappingURL=TemplateEditor.js.map