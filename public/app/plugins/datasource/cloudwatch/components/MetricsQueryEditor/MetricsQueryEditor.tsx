import React, { ChangeEvent, useState } from 'react';

import { QueryEditorProps } from '@grafana/data';
import { EditorField, EditorRow, Space } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Input } from '@grafana/ui';

import { MathExpressionQueryField, MetricStatEditor, SQLBuilderEditor, SQLCodeEditor } from '../';
import { CloudWatchDatasource } from '../../datasource';
import { isCloudWatchMetricsQuery } from '../../guards';
import {
  CloudWatchJsonData,
  CloudWatchMetricsQuery,
  CloudWatchQuery,
  MetricEditorMode,
  MetricQueryType,
  MetricStat,
} from '../../types';
import { DynamicLabelsField } from '../DynamicLabelsField';
import QueryHeader from '../QueryHeader';

import { Alias } from './Alias';
import usePreparedMetricsQuery from './usePreparedMetricsQuery';

export interface Props extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> {
  query: CloudWatchMetricsQuery;
}

export const MetricsQueryEditor = (props: Props) => {
  const { query, onRunQuery, datasource } = props;
  const [sqlCodeEditorIsDirty, setSQLCodeEditorIsDirty] = useState(false);
  const preparedQuery = usePreparedMetricsQuery(query, props.onChange);

  const onChange = (query: CloudWatchQuery) => {
    const { onChange, onRunQuery } = props;
    onChange(query);
    onRunQuery();
  };

  return (
    <>
      <QueryHeader
        query={query}
        onRunQuery={onRunQuery}
        datasource={datasource}
        onChange={(newQuery) => {
          if (isCloudWatchMetricsQuery(newQuery) && newQuery.metricEditorMode !== query.metricEditorMode) {
            setSQLCodeEditorIsDirty(false);
          }
          onChange(newQuery);
        }}
        sqlCodeEditorIsDirty={sqlCodeEditorIsDirty}
      />
      <Space v={0.5} />

      {query.metricQueryType === MetricQueryType.Search && (
        <>
          {query.metricEditorMode === MetricEditorMode.Builder && (
            <MetricStatEditor
              {...props}
              refId={query.refId}
              metricStat={query}
              onChange={(metricStat: MetricStat) => props.onChange({ ...query, ...metricStat })}
            ></MetricStatEditor>
          )}
          {query.metricEditorMode === MetricEditorMode.Code && (
            <MathExpressionQueryField
              onRunQuery={onRunQuery}
              expression={query.expression ?? ''}
              onChange={(expression) => props.onChange({ ...query, expression })}
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
                if (!sqlCodeEditorIsDirty) {
                  setSQLCodeEditorIsDirty(true);
                }
                props.onChange({ ...preparedQuery, sqlExpression });
              }}
              onRunQuery={onRunQuery}
              datasource={datasource}
            />
          )}

          {query.metricEditorMode === MetricEditorMode.Builder && (
            <>
              <SQLBuilderEditor
                query={query}
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
          invalid={!!query.id && !/^$|^[a-z][a-zA-Z0-9_]*$/.test(query.id)}
        >
          <Input
            id={`${query.refId}-cloudwatch-metric-query-editor-id`}
            onBlur={onRunQuery}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...preparedQuery, id: event.target.value })}
            type="text"
            value={query.id}
          />
        </EditorField>

        <EditorField label="Period" width={26} tooltip="Minimum interval between points in seconds.">
          <Input
            id={`${query.refId}-cloudwatch-metric-query-editor-period`}
            value={query.period || ''}
            placeholder="auto"
            onBlur={onRunQuery}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({ ...preparedQuery, period: event.target.value })
            }
          />
        </EditorField>

        {config.featureToggles.cloudWatchDynamicLabels ? (
          <EditorField
            label="Label"
            width={26}
            optional
            tooltip="Change time series legend name using Dynamic labels. See documentation for details."
          >
            <DynamicLabelsField
              width={52}
              onRunQuery={onRunQuery}
              label={preparedQuery.label ?? ''}
              onChange={(label) => props.onChange({ ...query, label })}
            ></DynamicLabelsField>
          </EditorField>
        ) : (
          <EditorField
            label="Alias"
            width={26}
            optional
            tooltip="Change time series legend name using this field. See documentation for replacement variable formats."
          >
            <Alias
              id={`${query.refId}-cloudwatch-metric-query-editor-alias`}
              value={preparedQuery.alias ?? ''}
              onChange={(value: string) => onChange({ ...preparedQuery, alias: value })}
            />
          </EditorField>
        )}
      </EditorRow>
    </>
  );
};
