/**
 * This file contains the template editor we'll be using for alertmanager templates.
 *
 * It includes auto-complete for template data and syntax highlighting
 */
import { editor } from 'monaco-editor';
import React, { FC } from 'react';

import { CodeEditor } from '@grafana/ui';
import { CodeEditorProps } from '@grafana/ui/src/components/Monaco/types';

import goTemplateLanguageDefinition, { GO_TEMPLATE_LANGUAGE_ID } from './editor/definition';
import { registerLanguage } from './editor/register';

const getSuggestions = () => {
  return [];
};

type TemplateEditorProps = Omit<CodeEditorProps, 'language' | 'theme'> & {
  autoHeight?: boolean;
};

const TemplateEditor: FC<TemplateEditorProps> = (props) => {
  const shouldAutoHeight = Boolean(props.autoHeight);

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

  return (
    <CodeEditor
      showLineNumbers={true}
      getSuggestions={getSuggestions}
      showMiniMap={false}
      {...props}
      onEditorDidMount={onEditorDidMount}
      onBeforeEditorMount={(monaco) => {
        registerLanguage(monaco, goTemplateLanguageDefinition);
      }}
      language={GO_TEMPLATE_LANGUAGE_ID}
    />
  );
};

export { TemplateEditor };
