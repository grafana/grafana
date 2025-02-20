/**
 * This file contains the template editor we'll be using for alertmanager templates.
 *
 * It includes auto-complete for template data and syntax highlighting
 */
import { IDisposable, editor } from 'monaco-editor';
import { useEffect, useRef } from 'react';

import { CodeEditor } from '@grafana/ui';
import { CodeEditorProps } from '@grafana/ui/src/components/Monaco/types';

import { registerGoTemplateAutocomplete } from './editor/autocomplete';
import goTemplateLanguageDefinition, { GO_TEMPLATE_LANGUAGE_ID } from './editor/definition';
import { registerLanguage } from './editor/register';

type TemplateEditorProps = Omit<CodeEditorProps, 'language' | 'theme'> & {
  autoHeight?: boolean;
};

const TemplateEditor = (props: TemplateEditorProps) => {
  const shouldAutoHeight = Boolean(props.autoHeight);
  const disposeSuggestions = useRef<IDisposable | null>(null);

  const onEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    if (shouldAutoHeight) {
      const contentHeight = editor.getContentHeight();

      try {
        // we're passing NaN in to the width because the type definition wants a number (NaN is a number, go figure)
        // but the width could be defined as a string "auto", passing NaN seems to just ignore our width update here
        editor.layout({ height: contentHeight, width: NaN });
      } catch (err) {}
    }
  };

  useEffect(() => {
    return () => {
      disposeSuggestions.current?.dispose();
    };
  }, []);

  return (
    <CodeEditor
      showLineNumbers={true}
      showMiniMap={false}
      {...props}
      monacoOptions={{
        scrollBeyondLastLine: false,
      }}
      onEditorDidMount={onEditorDidMount}
      onBeforeEditorMount={(monaco) => {
        registerLanguage(monaco, goTemplateLanguageDefinition);
        disposeSuggestions.current = registerGoTemplateAutocomplete(monaco);
      }}
      language={GO_TEMPLATE_LANGUAGE_ID}
    />
  );
};

export { TemplateEditor };
