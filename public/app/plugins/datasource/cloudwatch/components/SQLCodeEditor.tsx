import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import React, { useCallback, useEffect } from 'react';

import { CodeEditor, Monaco } from '@grafana/ui';

import { CloudWatchDatasource } from '../datasource';
import language from '../language/cloudwatch-sql/definition';
import { TRIGGER_SUGGEST } from '../language/monarch/commands';
import { registerLanguage } from '../language/monarch/register';

export interface Props {
  region: string;
  sql: string;
  onChange: (sql: string) => void;
  datasource: CloudWatchDatasource;
}

export const SQLCodeEditor = ({ region, sql, onChange, datasource }: Props) => {
  useEffect(() => {
    datasource.sqlCompletionItemProvider.setRegion(region);
  }, [region, datasource]);

  const onEditorMount = useCallback(
    (editor: monacoType.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editor.onDidFocusEditorText(() => editor.trigger(TRIGGER_SUGGEST.id, TRIGGER_SUGGEST.id, {}));
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        const text = editor.getValue();
        onChange(text);
      });
    },
    [onChange]
  );

  return (
    <CodeEditor
      height={'150px'}
      language={language.id}
      value={sql}
      onBlur={(value) => {
        if (value !== sql) {
          onChange(value);
        }
      }}
      showMiniMap={false}
      showLineNumbers={true}
      onBeforeEditorMount={(monaco: Monaco) => registerLanguage(monaco, language, datasource.sqlCompletionItemProvider)}
      onEditorDidMount={onEditorMount}
    />
  );
};
