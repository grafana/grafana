import { LanguageMap, languages as prismLanguages } from 'prismjs';
import React, { ReactNode } from 'react';
import { Node, Plugin } from 'slate';
import { Editor } from 'slate-react';

import { AbsoluteTimeRange, QueryEditorProps } from '@grafana/data';
import {
  BracesPlugin,
  CodeEditor,
  Monaco,
  QueryField,
  SlatePrism,
  Themeable2,
  TypeaheadInput,
  TypeaheadOutput,
  withTheme2,
} from '@grafana/ui';

// Utils & Services
// dom also includes Element polyfills
import { CloudWatchDatasource } from '../datasource';
import syntax from '../language/cloudwatch-logs/syntax';
import language from '../language/logs/definition';
import { registerLanguage } from '../language/monarch/register';
import { CloudWatchJsonData, CloudWatchLogsQuery, CloudWatchQuery } from '../types';
import { getStatsGroups } from '../utils/query/getStatsGroups';

import { LogGroupsField } from './LogGroups/LogGroupsField';

export interface CloudWatchLogsQueryFieldProps
  extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>,
    Themeable2 {
  absoluteRange: AbsoluteTimeRange;
  onLabelsRefresh?: () => void;
  ExtraFieldElement?: ReactNode;
  exploreId: string;
  query: CloudWatchLogsQuery;
}
const plugins: Array<Plugin<Editor>> = [
  BracesPlugin(),
  SlatePrism(
    {
      onlyIn: (node: Node) => node.object === 'block' && node.type === 'code_block',
      getSyntax: (node: Node) => 'cloudwatch',
    },
    { ...(prismLanguages as LanguageMap), cloudwatch: syntax }
  ),
];
export const CloudWatchLogsQueryField = (props: CloudWatchLogsQueryFieldProps) => {
  const { query, datasource, onChange, ExtraFieldElement, data } = props;

  const showError = data?.error?.refId === query.refId;
  const cleanText = datasource.languageProvider.cleanText;

  const onChangeQuery = (value: string) => {
    // Send text change to parent
    const nextQuery = {
      ...query,
      expression: value,
      statsGroups: getStatsGroups(value),
    };
    onChange(nextQuery);
  };

  const onTypeahead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    const { datasource, query } = props;
    const { logGroups } = query;

    if (!datasource.languageProvider) {
      return { suggestions: [] };
    }

    const { history, absoluteRange } = props;
    const { prefix, text, value, wrapperClasses, labelKey, editor } = typeahead;

    return await datasource.languageProvider.provideCompletionItems(
      { text, value, prefix, wrapperClasses, labelKey, editor },
      {
        history,
        absoluteRange,
        logGroups: logGroups,
        region: query.region,
      }
    );
  };

  return (
    <>
      <LogGroupsField
        region={query.region}
        datasource={datasource}
        legacyLogGroupNames={query.logGroupNames}
        logGroups={query.logGroups}
        onChange={(logGroups) => {
          onChange({ ...query, logGroups, logGroupNames: undefined });
        }}
      />
      <div className="gf-form-inline gf-form-inline--nowrap flex-grow-1">
        <div className="gf-form gf-form--grow flex-shrink-1">
          <QueryField
            additionalPlugins={plugins}
            query={query.expression ?? ''}
            onChange={onChangeQuery}
            onTypeahead={onTypeahead}
            cleanText={cleanText}
            placeholder="Enter a CloudWatch Logs Insights query (run with Shift+Enter)"
            portalOrigin="cloudwatch"
          />
        </div>
        {ExtraFieldElement}
      </div>
      {showError ? (
        <div className="query-row-break">
          <div className="prom-query-field-info text-error">{data?.error?.message}</div>
        </div>
      ) : null}
      <div>
        <CodeEditor
          height={'150px'}
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
          }}
          onBeforeEditorMount={(monaco: Monaco) =>
            registerLanguage(monaco, language, datasource.logsCompletionItemProvider)
          }
          // onEditorDidMount={onEditorMount}
        />
      </div>
    </>
  );
};

export default withTheme2(CloudWatchLogsQueryField);
