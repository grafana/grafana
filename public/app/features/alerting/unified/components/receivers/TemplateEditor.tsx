/**
 * This file contains the template editor we'll be using for alertmanager templates.
 *
 * It includes auto-complete for template data and syntax highlighting
 */
import React, { FC } from 'react';

import { CodeEditor } from '@grafana/ui';
import { CodeEditorProps } from '@grafana/ui/src/components/Monaco/types';

import goTemplateLanguageDefinition, { GO_TEMPLATE_LANGUAGE_ID, GO_TEMPLATE_THEME_ID } from './editor/definition';
import { registerLanguage } from './editor/register';

const getSuggestions = () => {
  return [];
};

type TemplateEditorProps = Omit<CodeEditorProps, 'language' | 'theme'>;

const TemplateEditor: FC<TemplateEditorProps> = (props) => {
  return (
    <CodeEditor
      {...props}
      showLineNumbers={true}
      getSuggestions={getSuggestions}
      showMiniMap={false}
      onBeforeEditorMount={(monaco) => registerLanguage(monaco, goTemplateLanguageDefinition)}
      theme={GO_TEMPLATE_THEME_ID}
      language={GO_TEMPLATE_LANGUAGE_ID}
    />
  );
};

export { TemplateEditor };
