import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import React, { ReactNode, useCallback, useRef } from 'react';

import { QueryEditorProps } from '@grafana/data';
import { CodeEditor, Monaco, Themeable2, withTheme2 } from '@grafana/ui';

import { CloudWatchDatasource } from '../../../datasource';
import language from '../../../language/logs/definition';
import { TRIGGER_SUGGEST } from '../../../language/monarch/commands';
import { registerLanguage, reRegisterCompletionProvider } from '../../../language/monarch/register';
import { CloudWatchJsonData, CloudWatchLogsQuery, CloudWatchQuery } from '../../../types';
import { getStatsGroups } from '../../../utils/query/getStatsGroups';
import { LogGroupsFieldWrapper } from '../../shared/LogGroups/LogGroupsField';

export interface CloudWatchLogsQueryFieldProps
  extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>,
    Themeable2 {
  ExtraFieldElement?: ReactNode;
  query: CloudWatchLogsQuery;
}
export const CloudWatchLogsQueryFieldMonaco = (props: CloudWatchLogsQueryFieldProps) => {
  const { query, datasource, onChange, ExtraFieldElement, data } = props;

  const showError = data?.error?.refId === query.refId;
  const monacoRef = useRef<Monaco>();
  const disposalRef = useRef<monacoType.IDisposable>();

  const onChangeLogs = useCallback(
    async (query: CloudWatchLogsQuery) => {
      onChange(query);
    },
    [onChange]
  );

  const onFocus = useCallback(async () => {
    disposalRef.current = await reRegisterCompletionProvider(
      monacoRef.current!,
      language,
      datasource.logsCompletionItemProviderFunc({
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
      datasource.logsCompletionItemProviderFunc({
        region: query.region,
        logGroups: query.logGroups,
      })
    );
  };

  return (
    <>
      <LogGroupsFieldWrapper
        region={query.region}
        datasource={datasource}
        legacyLogGroupNames={query.logGroupNames}
        logGroups={query.logGroups}
        onChange={(logGroups) => {
          onChangeLogs({ ...query, logGroups, logGroupNames: undefined });
        }}
        //legacy props
        legacyOnChange={(logGroupNames) => {
          onChangeLogs({ ...query, logGroupNames });
        }}
      />
      <div className="gf-form-inline gf-form-inline--nowrap flex-grow-1">
        <div className="gf-form--grow flex-shrink-1">
          <CodeEditor
            height="150px"
            width="100%"
            showMiniMap={false}
            monacoOptions={{
              // without this setting, the auto-resize functionality causes an infinite loop, don't remove it!
              scrollBeyondLastLine: false,

              // These additional options are style focused and are a subset of those in the query editor in Prometheus
              fontSize: 14,
              lineNumbers: 'off',
              renderLineHighlight: 'none',
              scrollbar: {
                vertical: 'hidden',
                horizontal: 'hidden',
              },
              suggestFontSize: 12,
              wordWrap: 'on',
              padding: {
                top: 6,
              },
            }}
            language={language.id}
            value={query.expression ?? ''}
            onBlur={(value) => {
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
        </div>
        {ExtraFieldElement}
      </div>
      {showError ? (
        <div className="query-row-break">
          <div className="prom-query-field-info text-error">{data?.error?.message}</div>
        </div>
      ) : null}
    </>
  );
};

export default withTheme2(CloudWatchLogsQueryFieldMonaco);
