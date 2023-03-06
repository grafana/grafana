import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { EditorField, EditorRow, InlineSelect, Space } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { ConfirmModal, Input, RadioButtonGroup } from '@grafana/ui';

import { MathExpressionQueryField, MetricStatEditor, SQLBuilderEditor } from '../';
import { CloudWatchDatasource } from '../../datasource';
import useMigratedMetricsQuery from '../../migrations/useMigratedMetricsQuery';
import {
  CloudWatchJsonData,
  CloudWatchMetricsQuery,
  CloudWatchQuery,
  MetricEditorMode,
  MetricQueryType,
  MetricStat,
} from '../../types';
import { DynamicLabelsField } from '../DynamicLabelsField';
import { SQLCodeEditor } from '../SQLCodeEditor';

import { Alias } from './Alias';

export interface Props extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> {
  query: CloudWatchMetricsQuery;
  extraHeaderElementLeft?: React.Dispatch<JSX.Element | undefined>;
  extraHeaderElementRight?: React.Dispatch<JSX.Element | undefined>;
}

const metricEditorModes: Array<SelectableValue<MetricQueryType>> = [
  { label: 'Metric Search', value: MetricQueryType.Search },
  { label: 'Metric Query', value: MetricQueryType.Query },
];
const editorModes = [
  { label: 'Builder', value: MetricEditorMode.Builder },
  { label: 'Code', value: MetricEditorMode.Code },
];

export const MetricsQueryEditor = (props: Props) => {
  const { query, datasource, extraHeaderElementLeft, extraHeaderElementRight, onChange } = props;
  const [showConfirm, setShowConfirm] = useState(false);
  const [sqlCodeEditorIsDirty, setSQLCodeEditorIsDirty] = useState(false);
  const migratedQuery = useMigratedMetricsQuery(query, props.onChange);

  const onEditorModeChange = useCallback(
    (newMetricEditorMode: MetricEditorMode) => {
      if (
        sqlCodeEditorIsDirty &&
        query.metricQueryType === MetricQueryType.Query &&
        query.metricEditorMode === MetricEditorMode.Code
      ) {
        setShowConfirm(true);
        return;
      }
      onChange({ ...query, metricEditorMode: newMetricEditorMode });
    },
    [setShowConfirm, onChange, sqlCodeEditorIsDirty, query]
  );

  useEffect(() => {
    extraHeaderElementLeft?.(
      <InlineSelect
        aria-label="Metric editor mode"
        value={metricEditorModes.find((m) => m.value === query.metricQueryType)}
        options={metricEditorModes}
        onChange={({ value }) => {
          onChange({ ...query, metricQueryType: value });
        }}
      />
    );

    extraHeaderElementRight?.(
      <>
        <RadioButtonGroup
          options={editorModes}
          size="sm"
          value={query.metricEditorMode}
          onChange={onEditorModeChange}
        />
        <ConfirmModal
          isOpen={showConfirm}
          title="Are you sure?"
          body="You will lose manual changes done to the query if you go back to the visual builder."
          confirmText="Yes, I am sure."
          dismissText="No, continue editing the query manually."
          icon="exclamation-triangle"
          onConfirm={() => {
            setShowConfirm(false);
            onChange({ ...query, metricEditorMode: MetricEditorMode.Builder });
          }}
          onDismiss={() => setShowConfirm(false)}
        />
      </>
    );

    return () => {
      extraHeaderElementLeft?.(undefined);
      extraHeaderElementRight?.(undefined);
    };
  }, [
    query,
    sqlCodeEditorIsDirty,
    datasource,
    onChange,
    extraHeaderElementLeft,
    extraHeaderElementRight,
    showConfirm,
    onEditorModeChange,
  ]);

  return (
    <>
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
                props.onChange({ ...migratedQuery, sqlExpression });
              }}
              datasource={datasource}
            />
          )}

          {query.metricEditorMode === MetricEditorMode.Builder && (
            <>
              <SQLBuilderEditor query={query} onChange={props.onChange} datasource={datasource}></SQLBuilderEditor>
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
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...migratedQuery, id: event.target.value })}
            type="text"
            value={query.id}
          />
        </EditorField>

        <EditorField label="Period" width={26} tooltip="Minimum interval between points in seconds.">
          <Input
            id={`${query.refId}-cloudwatch-metric-query-editor-period`}
            value={query.period || ''}
            placeholder="auto"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({ ...migratedQuery, period: event.target.value })
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
              label={migratedQuery.label ?? ''}
              onChange={(label) => props.onChange({ ...query, label })}
            ></DynamicLabelsField>
          </EditorField>
        ) : (
          <EditorField label="Alias" width={26} optional tooltip="Change time series legend name using this field.">
            <Alias
              id={`${query.refId}-cloudwatch-metric-query-editor-alias`}
              value={migratedQuery.alias ?? ''}
              onChange={(value: string) => onChange({ ...migratedQuery, alias: value })}
            />
          </EditorField>
        )}
      </EditorRow>
    </>
  );
};
