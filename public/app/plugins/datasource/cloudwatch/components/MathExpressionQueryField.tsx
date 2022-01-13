import React, { useCallback } from 'react';
import { CodeEditor, Monaco } from '@grafana/ui';
import language from '../metric-math/definition';
import { registerLanguage } from '../monarch/register';
import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import { TRIGGER_SUGGEST } from '../monarch/commands';
import { CloudWatchDatasource } from '../datasource';

export interface Props {
  onChange: (query: string) => void;
  onRunQuery: () => void;
  expression: string;
  datasource: CloudWatchDatasource;
}

export function MathExpressionQueryField({
  expression: query,
  onChange,
  onRunQuery,
  datasource,
}: React.PropsWithChildren<Props>) {
  const onEditorMount = useCallback(
    (editor: monacoType.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editor.onDidFocusEditorText(() => editor.trigger(TRIGGER_SUGGEST.id, TRIGGER_SUGGEST.id, {}));
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        const text = editor.getValue();
        onChange(text);
        onRunQuery();
      });
    },
    [onChange, onRunQuery]
  );

  return (
    <CodeEditor
      height={'150px'}
      language={language.id}
      value={query}
      onBlur={(value) => {
        if (value !== query) {
          onChange(value);
        }
      }}
      showMiniMap={false}
      showLineNumbers={true}
      onBeforeEditorMount={(monaco: Monaco) =>
        registerLanguage(monaco, language, datasource.metricMathCompletionItemProvider)
      }
      onEditorDidMount={onEditorMount}
    />
  );
}
