import React, { ChangeEvent, useState } from 'react';

import { QueryEditorProps } from '@grafana/data';
import { EditorField, EditorRow, Space } from '@grafana/experimental';
import { Input } from '@grafana/ui';

import { CloudWatchDatasource } from '../datasource';
import { isCloudWatchMetricsQuery } from '../guards';
import {
  CloudWatchJsonData,
  CloudWatchMetricsQuery,
  CloudWatchQuery,
  MetricEditorMode,
  MetricQueryType,
  MetricStat,
} from '../types';

import QueryHeader from './QueryHeader';
import usePreparedMetricsQuery from './usePreparedMetricsQuery';

import { Alias, MathExpressionQueryField, MetricStatEditor, SQLBuilderEditor, SQLCodeEditor } from './';

export interface Props extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> {
  query: CloudWatchMetricsQuery;
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

export const MetricsQueryEditor = (props: Props) => {
  const { query, onRunQuery, datasource } = props;
  const [sqlCodeEditorIsDirty, setSQLCodeEditorIsDirty] = useState(false);
  const preparedQuery = usePreparedMetricsQuery(query, props.onChange);

  // if (!isCloudWatchMetricsQuery(query)) {
  //   return (
  //     <Alert severity="error" title="Invalid annotation query" topSpacing={2}>
  //       {JSON.stringify(query, null, 4)}
  //     </Alert>
  //   );
  // }

  // componentDidMount = () => {
  //   const metricsQuery = props.query as CloudWatchMetricsQuery;
  //   const query = normalizeQuery(metricsQuery);
  //   props.onChange(query);
  // };

  const onChange = (query: CloudWatchQuery) => {
    const { onChange, onRunQuery } = props;
    onChange(query);
    onRunQuery();
  };

  return (
    <>
      <QueryHeader
        query={preparedQuery}
        onRunQuery={onRunQuery}
        datasource={datasource}
        onChange={(newQuery) => {
          if (isCloudWatchMetricsQuery(newQuery) && newQuery.metricEditorMode !== preparedQuery.metricEditorMode) {
            setSQLCodeEditorIsDirty(false);
          }
          onChange(newQuery);
        }}
        sqlCodeEditorIsDirty={sqlCodeEditorIsDirty}
      />
      <Space v={0.5} />

      {preparedQuery.metricQueryType === MetricQueryType.Search && (
        <>
          {preparedQuery.metricEditorMode === MetricEditorMode.Builder && (
            <MetricStatEditor
              {...props}
              refId={preparedQuery.refId}
              metricStat={preparedQuery}
              onChange={(metricStat: MetricStat) => props.onChange({ ...preparedQuery, ...metricStat })}
            ></MetricStatEditor>
          )}
          {preparedQuery.metricEditorMode === MetricEditorMode.Code && (
            <MathExpressionQueryField
              onRunQuery={onRunQuery}
              expression={preparedQuery.expression ?? ''}
              onChange={(expression) => props.onChange({ ...preparedQuery, expression })}
              datasource={datasource}
            ></MathExpressionQueryField>
          )}
        </>
      )}
      {preparedQuery.metricQueryType === MetricQueryType.Query && (
        <>
          {preparedQuery.metricEditorMode === MetricEditorMode.Code && (
            <SQLCodeEditor
              region={preparedQuery.region}
              sql={preparedQuery.sqlExpression ?? ''}
              onChange={(sqlExpression) => {
                if (!sqlCodeEditorIsDirty) {
                  setSQLCodeEditorIsDirty(true);
                }
                props.onChange({ ...preparedQuery, sqlExpression });
              }}
              onRunQuery={onRunQuery}
              datasource={datasource}
            />
          )}

          {preparedQuery.metricEditorMode === MetricEditorMode.Builder && (
            <>
              <SQLBuilderEditor
                query={preparedQuery}
                onChange={props.onChange}
                onRunQuery={onRunQuery}
                datasource={datasource}
              ></SQLBuilderEditor>
            </>
          )}
        </>
      )}
      <Space v={0.5} />
      <EditorRow>
        <EditorField
          label="ID"
          width={26}
          optional
          tooltip="ID can be used to reference other queries in math expressions. The ID can include numbers, letters, and underscore, and must start with a lowercase letter."
          invalid={!!preparedQuery.id && !/^$|^[a-z][a-zA-Z0-9_]*$/.test(preparedQuery.id)}
        >
          <Input
            id={`${preparedQuery.refId}-cloudwatch-metric-query-editor-id`}
            onBlur={onRunQuery}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...preparedQuery, id: event.target.value })}
            type="text"
            value={preparedQuery.id}
          />
        </EditorField>

        <EditorField label="Period" width={26} tooltip="Minimum interval between points in seconds.">
          <Input
            id={`${preparedQuery.refId}-cloudwatch-metric-query-editor-period`}
            value={preparedQuery.period || ''}
            placeholder="auto"
            onBlur={onRunQuery}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({ ...preparedQuery, period: event.target.value })
            }
          />
        </EditorField>

        {query.alias !== undefined && (
          <EditorField
            label="Alias"
            width={26}
            optional
            tooltip="Change time series legend name using this field. See documentation for replacement variable formats."
          >
            <Alias
              value={preparedQuery.alias ?? ''}
              onChange={(value: string) => onChange({ ...preparedQuery, alias: value })}
            />
          </EditorField>
        )}

        <EditorField
          label="Label"
          width={26}
          optional
          tooltip="Change time series legend name using this field. See documentation for replacement variable formats."
        >
          <Alias
            value={preparedQuery.label ?? ''}
            onChange={(value: string) => onChange({ ...preparedQuery, label: value })}
          />
        </EditorField>
      </EditorRow>
    </>
  );
};
