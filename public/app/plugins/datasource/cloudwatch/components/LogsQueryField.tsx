import { css, cx } from '@emotion/css';
import { LanguageMap, languages as prismLanguages } from 'prismjs';
import React, { ReactNode } from 'react';
import { Node, Plugin } from 'slate';
import { Editor } from 'slate-react';

import { AbsoluteTimeRange, QueryEditorProps } from '@grafana/data';
import {
  BracesPlugin,
  QueryField,
  SlatePrism,
  TypeaheadInput,
  TypeaheadOutput,
  Themeable2,
  withTheme2,
  clearButtonStyles,
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
  ExtraFieldElement?: ReactNode;
  exploreId: ExploreId;
  query: CloudWatchLogsQuery;
}

const addPaddingToButton = css`
  padding: 1px 4px;
`;
interface State {
  hint:
    | {
        message: string;
        fix: {
          label: string;
          action: () => void;
        };
      }
    | undefined;
}

class CloudWatchLogsQueryField extends React.PureComponent<CloudWatchLogsQueryFieldProps, State> {
  state: State = {
    hint: undefined,
  };

  plugins: Array<Plugin<Editor>>;

  constructor(props: CloudWatchLogsQueryFieldProps, context: React.Context<any>) {
    super(props, context);

    this.plugins = [
      BracesPlugin(),
      SlatePrism(
        {
          onlyIn: (node: Node) => node.object === 'block' && node.type === 'code_block',
          getSyntax: (node: Node) => 'cloudwatch',
        },
        { ...(prismLanguages as LanguageMap), cloudwatch: syntax }
      ),
    ];
  }

  componentDidMount = () => {
    const { query, datasource, onChange } = this.props;

    if (onChange) {
      onChange({ ...query, logGroupNames: query.logGroupNames ?? datasource.logsQueryRunner.defaultLogGroups });
    }
  };

  onChangeQuery = (value: string) => {
    // Send text change to parent
    const { query, onChange } = this.props;

    if (onChange) {
      const nextQuery = {
        ...query,
        expression: value,
        statsGroups: getStatsGroups(value),
      };
      onChange(nextQuery);
    }
  };

  onTypeahead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    const { datasource, query } = this.props;
    const { logGroupNames } = query;

    if (!datasource.languageProvider) {
      return { suggestions: [] };
    }

    const cloudwatchLanguageProvider = datasource.languageProvider as CloudWatchLanguageProvider;
    const { history, absoluteRange } = this.props;
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

  render() {
    const { onRunQuery, onChange, ExtraFieldElement, data, query, datasource, theme } = this.props;
    const { expression } = query;
    const { hint } = this.state;

    const showError = data && data.error && data.error.refId === query.refId;
    const cleanText = datasource.languageProvider ? datasource.languageProvider.cleanText : undefined;

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
              additionalPlugins={this.plugins}
              query={expression ?? ''}
              onChange={this.onChangeQuery}
              onRunQuery={this.props.onRunQuery}
              onTypeahead={this.onTypeahead}
              cleanText={cleanText}
              placeholder="Enter a CloudWatch Logs Insights query (run with Shift+Enter)"
              portalOrigin="cloudwatch"
            />
          </div>
          {ExtraFieldElement}
        </div>
        {hint && (
          <div className="query-row-break">
            <div className="text-warning">
              {hint.message}
              <button
                type="button"
                className={cx(clearButtonStyles(theme), 'text-link', 'muted', addPaddingToButton)}
                onClick={hint.fix.action}
              >
                {hint.fix.label}
              </button>
            </div>
          </div>
        )}
        {showError ? (
          <div className="query-row-break">
            <div className="prom-query-field-info text-error">{data?.error?.message}</div>
          </div>
        ) : null}
      </>
    );
  }
}

export default withTheme2(CloudWatchLogsQueryField);
