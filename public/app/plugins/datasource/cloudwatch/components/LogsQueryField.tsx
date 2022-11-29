import { LanguageMap, languages as prismLanguages } from 'prismjs';
import * as React from 'react';
import { Node, Plugin } from 'slate';
import { Editor } from 'slate-react';

import { AbsoluteTimeRange, QueryEditorProps } from '@grafana/data';
import {
  BracesPlugin,
  QueryField,
  SlatePrism,
  Themeable2,
  TypeaheadInput,
  TypeaheadOutput,
  withTheme2,
} from '@grafana/ui';
import { ExploreId } from 'app/types';

// Utils & Services
// dom also includes Element polyfills
import { CloudWatchDatasource } from '../datasource';
import { CloudWatchLanguageProvider } from '../language_provider';
import syntax from '../syntax';
import { CloudWatchJsonData, CloudWatchLogsQuery, CloudWatchQuery } from '../types';
import { getStatsGroups } from '../utils/query/getStatsGroups';

import { LogGroupSelection } from './LogGroupSelection';
import QueryHeader from './QueryHeader';

export interface CloudWatchLogsQueryFieldProps
  extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>,
    Themeable2 {
  absoluteRange: AbsoluteTimeRange;
  onLabelsRefresh?: () => void;
  ExtraFieldElement?: React.ReactNode;
  exploreId: ExploreId;
  query: CloudWatchLogsQuery;
}

export const CloudWatchLogsQueryField = (props: CloudWatchLogsQueryFieldProps) => {
  const { query, datasource, onChange, onRunQuery, ExtraFieldElement, data } = props;

  const showError = data && data.error && data.error.refId === query.refId;
  const cleanText = datasource.languageProvider ? datasource.languageProvider.cleanText : undefined;

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

  onChangeQuery = (value: string) => {
    // Send text change to parent
      const nextQuery = {
        ...query,
        expression: value,
        statsGroups: getStatsGroups(value),
      };
      onChange(nextQuery);
  };

  const onTypeahead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    const { logGroupNames } = query;

    if (!datasource.languageProvider) {
      return { suggestions: [] };
    }

    const cloudwatchLanguageProvider = datasource.languageProvider as CloudWatchLanguageProvider;
    const { history, absoluteRange } = props;
    const { prefix, text, value, wrapperClasses, labelKey, editor } = typeahead;

    return await cloudwatchLanguageProvider.provideCompletionItems(
      { text, value, prefix, wrapperClasses, labelKey, editor },
      {
        history,
        absoluteRange,
        logGroupNames,
        region: query.region,
      }
    );
  };

  return (
    <>
      <QueryHeader
        query={query}
        onRunQuery={onRunQuery}
        datasource={datasource}
        onChange={onChange}
        sqlCodeEditorIsDirty={false}
      />
      <LogGroupSelection datasource={datasource} query={query} onChange={onChange} onRunQuery={onRunQuery} />
      <div className="gf-form-inline gf-form-inline--nowrap flex-grow-1">
        <div className="gf-form gf-form--grow flex-shrink-1">
          <QueryField
            additionalPlugins={plugins}
            query={query.expression ?? ''}
            onChange={onChangeQuery}
            onRunQuery={props.onRunQuery}
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
    </>
  );
};

export default withTheme2(CloudWatchLogsQueryField);
