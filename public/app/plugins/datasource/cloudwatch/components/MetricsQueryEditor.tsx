import { QueryEditorProps } from '@grafana/data';
import { Space } from '@grafana/experimental';
import React, { ChangeEvent, PureComponent } from 'react';

import { CloudWatchDatasource } from '../datasource';
import { isMetricsQuery } from '../guards';
import { CloudWatchJsonData, CloudWatchMetricsQuery, CloudWatchQuery, MetricEditorMode, MetricQueryType } from '../types';
import { MathExpressionQueryField, MetricStatEditor, SQLBuilderEditor, SQLCodeEditor } from './';
import QueryHeader from './QueryHeader';

export type Props = QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>;

interface State {
  sqlCodeEditorIsDirty: boolean;
}

export const normalizeQuery = ({
  namespace,
  metricName,
  expression,
  dimensions,
  region,
  id,
  alias,
  statistic,
  period,
  sqlExpression,
  metricQueryType,
  metricEditorMode,
  ...rest
}: CloudWatchMetricsQuery): CloudWatchMetricsQuery => {
  const normalizedQuery = {
    queryMode: 'Metrics' as const,
    namespace: namespace ?? '',
    metricName: metricName ?? '',
    expression: expression ?? '',
    dimensions: dimensions ?? {},
    region: region ?? 'default',
    id: id ?? '',
    alias: alias ?? '',
    statistic: statistic ?? 'Average',
    period: period ?? '',
    metricQueryType: metricQueryType ?? MetricQueryType.Search,
    metricEditorMode: metricEditorMode ?? MetricEditorMode.Builder,
    sqlExpression: sqlExpression ?? '',
    ...rest,
  };
  return !rest.hasOwnProperty('matchExact') ? { ...normalizedQuery, matchExact: true } : normalizedQuery;
};

export class MetricsQueryEditor extends PureComponent<Props, State> {
  state = {
    sqlCodeEditorIsDirty: false,
  };

  componentDidMount = () => {
    const metricsQuery = this.props.query as CloudWatchMetricsQuery;
    const query = normalizeQuery(metricsQuery);
    this.props.onChange(query);
  };

  onChange = (query: CloudWatchQuery) => {
    const { onChange, onRunQuery } = this.props;
    onChange(query);
    onRunQuery();
  };

  render() {
    const { onRunQuery, datasource } = this.props;
    const metricsQuery = this.props.query as CloudWatchMetricsQuery;
    const query = normalizeQuery(metricsQuery);

    return (
      <>
        <QueryHeader
          query={query}
          onRunQuery={onRunQuery}
          datasource={datasource}
          onChange={(newQuery) => {
            if (isMetricsQuery(newQuery) && newQuery.metricEditorMode !== query.metricEditorMode) {
              this.setState({ sqlCodeEditorIsDirty: false });
            }
            this.onChange(newQuery);
          }}
          sqlCodeEditorIsDirty={this.state.sqlCodeEditorIsDirty}
        />
        <Space v={0.5} />

        {query.metricQueryType === MetricQueryType.Search && (
          <>
            {query.metricEditorMode === MetricEditorMode.Builder && (
              <MetricStatEditor {...{ ...this.props, query }}></MetricStatEditor>
            )}
            {query.metricEditorMode === MetricEditorMode.Code && (
              <MathExpressionQueryField
                onRunQuery={onRunQuery}
                expression={query.expression ?? ''}
                onChange={(expression) => this.props.onChange({ ...query, expression })}
                datasource={datasource}
              ></MathExpressionQueryField>
            )}
          </>
        )}
        {query.metricQueryType === MetricQueryType.Query && (
          <>
            {query.metricEditorMode === MetricEditorMode.Code && (
              <SQLCodeEditor
                region={query.region}
                sql={query.sqlExpression ?? ''}
                onChange={(sqlExpression) => {
                  if (!this.state.sqlCodeEditorIsDirty) {
                    this.setState({ sqlCodeEditorIsDirty: true });
                  }
                  this.props.onChange({ ...metricsQuery, sqlExpression });
                }}
                onRunQuery={onRunQuery}
                datasource={datasource}
              />
            )}

            {query.metricEditorMode === MetricEditorMode.Builder && (
              <>
                <SQLBuilderEditor
                  query={query}
                  onChange={this.props.onChange}
                  onRunQuery={onRunQuery}
                  datasource={datasource}
                ></SQLBuilderEditor>
              </>
            )}
          </>
        )}
        <Space v={0.5} />
      </>
    );
  }
}
