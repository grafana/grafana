import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import { useCallback, useRef } from 'react';

import { CodeEditor, Monaco } from '@grafana/ui';

import { CloudWatchDatasource } from '../../../../datasource';
import language from '../../../../language/cloudwatch-logs-sql/definition';
import { TRIGGER_SUGGEST } from '../../../../language/monarch/commands';
import { registerLanguage, reRegisterCompletionProvider } from '../../../../language/monarch/register';
import { CloudWatchLogsQuery } from '../../../../types';
import { getStatsGroups } from '../../../../utils/query/getStatsGroups';

import { codeEditorCommonProps } from './PPLQueryEditor';

interface SQLCodeEditorProps {
  query: CloudWatchLogsQuery;
  datasource: CloudWatchDatasource;
  onChange: (query: CloudWatchLogsQuery) => void;
}
export const SQLQueryEditor = (props: SQLCodeEditorProps) => {
  const { query, datasource, onChange } = props;

  const monacoRef = useRef<Monaco>();
  const disposalRef = useRef<monacoType.IDisposable>();

  const onFocus = useCallback(async () => {
    disposalRef.current = await reRegisterCompletionProvider(
      monacoRef.current!,
      language,
      datasource.logsSqlCompletionItemProviderFunc({
        region: query.region,
        logGroups: query.logGroups,
      }),
      disposalRef.current
    );
  }, [datasource, query.logGroups, query.region]);

  const onChangeQuery = useCallback(
    (value: string) => {
      const nextQuery = {
        ...query,
        expression: value,
        statsGroups: getStatsGroups(value),
      };
      onChange(nextQuery);
    },
    [onChange, query]
  );
  const onEditorMount = useCallback(
    (editor: monacoType.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editor.onDidFocusEditorText(() => editor.trigger(TRIGGER_SUGGEST.id, TRIGGER_SUGGEST.id, {}));
      editor.onDidChangeModelContent(() => {
        const model = editor.getModel();
        if (model?.getValue().trim() === '') {
          editor.trigger(TRIGGER_SUGGEST.id, TRIGGER_SUGGEST.id, {});
        }
      });
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        const text = editor.getValue();
        onChangeQuery(text);
      });
    },
    [onChangeQuery]
  );
  const onBeforeEditorMount = async (monaco: Monaco) => {
    monacoRef.current = monaco;
    disposalRef.current = await registerLanguage(
      monaco,
      language,
      datasource.logsSqlCompletionItemProviderFunc({
        region: query.region,
        logGroups: query.logGroups,
      })
    );
  };
  return (
    <CodeEditor
      {...codeEditorCommonProps}
      language={language.id}
      value={query.expression ?? ''}
      onBlur={(value: string) => {
        if (value !== query.expression) {
          onChangeQuery(value);
        }
        disposalRef.current?.dispose();
      }}
      onFocus={onFocus}
      onBeforeEditorMount={onBeforeEditorMount}
      onEditorDidMount={onEditorMount}
      onEditorWillUnmount={() => disposalRef.current?.dispose()}
    />
  );
};
