import { css } from '@emotion/css';
import { type ChangeEvent, useCallback, useEffect, useId, useState, type JSX } from 'react';
import * as React from 'react';

import { getDefaultTimeRange, type GrafanaTheme2, type QueryEditorProps, type SelectableValue } from '@grafana/data';
import { EditorField, EditorRow, InlineSelect } from '@grafana/plugin-ui';
import { buildVisualQueryFromString } from '@grafana/prometheus';
import { config } from '@grafana/runtime';
import { ConfirmModal, Input, RadioButtonGroup, Space, Stack, Switch, useStyles2 } from '@grafana/ui';

import {
  type CloudWatchMetricsQuery,
  MetricEditorMode,
  MetricQueryType,
  type MetricStat,
} from '../../../dataquery.gen';
import { type CloudWatchDatasource } from '../../../datasource';
import { DEFAULT_METRICS_QUERY } from '../../../defaultQueries';
import useMigratedMetricsQuery from '../../../migrations/useMigratedMetricsQuery';
import { type CloudWatchQuery, type CloudWatchJsonData } from '../../../types';
import { MetricStatEditor } from '../../shared/MetricStatEditor/MetricStatEditor';

import { DynamicLabelsField } from './DynamicLabelsField';
import { MathExpressionQueryField } from './MathExpressionQueryField';
import { PromQLBuilderEditor } from './PromQLBuilderEditor';
import { PromQLCodeEditor } from './PromQLCodeEditor';
import { SQLBuilderEditor } from './SQLBuilderEditor/SQLBuilderEditor';
import { SQLCodeEditor } from './SQLCodeEditor';

export interface Props extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> {
  query: CloudWatchMetricsQuery;
  extraHeaderElementLeft?: React.Dispatch<JSX.Element | undefined>;
  extraHeaderElementRight?: React.Dispatch<JSX.Element | undefined>;
}

const metricEditorModes: Array<SelectableValue<MetricQueryType>> = [
  { label: 'Metric Search', value: MetricQueryType.Search },
  { label: 'Metric Insights', value: MetricQueryType.Insights },
  { label: 'PromQL', value: MetricQueryType.PromQL },
];
const editorModes = [
  { label: 'Builder', value: MetricEditorMode.Builder },
  { label: 'Code', value: MetricEditorMode.Code },
];

export const MetricsQueryEditor = (props: Props) => {
  const { query, datasource, extraHeaderElementLeft, extraHeaderElementRight, onChange } = props;
  const [showConfirm, setShowConfirm] = useState(false);
  const [promQLParseModalOpen, setPromQLParseModalOpen] = useState(false);
  const [codeEditorIsDirty, setCodeEditorIsDirty] = useState(false);
  const [showPromQLExplain, setShowPromQLExplain] = useState(false);
  const promQLExplainSwitchId = useId();
  const styles = useStyles2(getStyles);
  const migratedQuery = useMigratedMetricsQuery(query, props.onChange);

  const onEditorModeChange = useCallback(
    (newMetricEditorMode: MetricEditorMode) => {
      if (
        codeEditorIsDirty &&
        query.metricQueryType === MetricQueryType.Insights &&
        query.metricEditorMode === MetricEditorMode.Code
      ) {
        setShowConfirm(true);
        return;
      }
      if (
        query.metricQueryType === MetricQueryType.PromQL &&
        query.metricEditorMode === MetricEditorMode.Code &&
        newMetricEditorMode === MetricEditorMode.Builder
      ) {
        const parseResult = buildVisualQueryFromString(query.promqlExpression ?? '');
        if (parseResult.errors.length > 0) {
          setPromQLParseModalOpen(true);
          return;
        }
      }
      onChange({ ...query, metricEditorMode: newMetricEditorMode });
    },
    [setShowConfirm, onChange, codeEditorIsDirty, query]
  );

  const updateAccounIdOnMount = () => {
    if (config.featureToggles.cloudWatchCrossAccountQuerying && query.accountId) {
      datasource.resources.isMonitoringAccount(query.region).then((isMonitoring) => {
        if (!isMonitoring && query.accountId) {
          onChange({ ...query, accountId: undefined });
        }
      });
    }
  };
  useEffect(updateAccounIdOnMount, [datasource, onChange, query]);

  useEffect(() => {
    extraHeaderElementLeft?.(
      <>
        <InlineSelect
          aria-label="Metric editor mode"
          value={metricEditorModes.find((m) => m.value === query.metricQueryType)}
          options={metricEditorModes}
          onChange={({ value }) => {
            if (
              codeEditorIsDirty &&
              query.metricQueryType === MetricQueryType.Search &&
              query.metricEditorMode === MetricEditorMode.Builder
            ) {
              setShowConfirm(true);
              return;
            }
            onChange({ ...query, metricQueryType: value });
          }}
        />
        {query.metricQueryType === MetricQueryType.PromQL && (
          <Stack direction="row" gap={1} alignItems="center">
            <label htmlFor={promQLExplainSwitchId} className={styles.promQLExplainLabel}>
              Explain
            </label>
            <Switch
              id={promQLExplainSwitchId}
              value={showPromQLExplain}
              onChange={(event) => setShowPromQLExplain(event.currentTarget.checked)}
            />
          </Stack>
        )}
      </>
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
          body="You will lose changes made to the query if you change to Metric Insights Builder mode."
          confirmText="Yes, I am sure."
          dismissText="No, continue editing the query."
          onConfirm={() => {
            setShowConfirm(false);
            setCodeEditorIsDirty(false);
            onChange({
              ...query,
              ...DEFAULT_METRICS_QUERY,
              metricQueryType: MetricQueryType.Insights,
              metricEditorMode: MetricEditorMode.Builder,
            });
          }}
          onDismiss={() => setShowConfirm(false)}
        />
        <ConfirmModal
          isOpen={promQLParseModalOpen}
          title="Parsing error: Switch to builder mode?"
          body="There is a syntax error, or the query structure cannot be visualized when switching to builder mode. Parts of the query may be lost."
          confirmText="Continue"
          dismissText="Cancel"
          onConfirm={() => {
            setPromQLParseModalOpen(false);
            onChange({ ...query, metricEditorMode: MetricEditorMode.Builder });
          }}
          onDismiss={() => setPromQLParseModalOpen(false)}
        />
      </>
    );

    return () => {
      extraHeaderElementLeft?.(undefined);
      extraHeaderElementRight?.(undefined);
    };
  }, [
    query,
    codeEditorIsDirty,
    datasource,
    onChange,
    extraHeaderElementLeft,
    extraHeaderElementRight,
    showConfirm,
    promQLParseModalOpen,
    showPromQLExplain,
    promQLExplainSwitchId,
    styles.promQLExplainLabel,
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
              onChange={(metricStat: MetricStat) => {
                if (!codeEditorIsDirty) {
                  setCodeEditorIsDirty(true);
                }
                props.onChange({ ...query, ...metricStat });
              }}
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
      {query.metricQueryType === MetricQueryType.Insights && (
        <>
          {query.metricEditorMode === MetricEditorMode.Code && (
            <SQLCodeEditor
              region={query.region}
              sql={query.sqlExpression ?? ''}
              onChange={(sqlExpression) => {
                if (!codeEditorIsDirty) {
                  setCodeEditorIsDirty(true);
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
      {query.metricQueryType === MetricQueryType.PromQL && (
        <>
          {query.metricEditorMode === MetricEditorMode.Code && (
            <PromQLCodeEditor
              query={query}
              onChange={props.onChange}
              onRunQuery={props.onRunQuery}
              datasource={datasource}
              timeRange={props.range ?? getDefaultTimeRange()}
              app={props.app}
              showExplain={showPromQLExplain}
              data={props.data}
            />
          )}
          {query.metricEditorMode === MetricEditorMode.Builder && (
            <PromQLBuilderEditor
              query={query}
              onChange={props.onChange}
              onRunQuery={props.onRunQuery}
              datasource={datasource}
              timeRange={props.range ?? getDefaultTimeRange()}
              app={props.app}
              showExplain={showPromQLExplain}
              data={props.data}
            />
          )}
        </>
      )}
      {query.metricQueryType !== MetricQueryType.PromQL && (
        <>
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
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onChange({ ...migratedQuery, id: event.target.value })
                }
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
          </EditorRow>
        </>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  promQLExplainLabel: css({
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    fontSize: theme.typography.bodySmall.fontSize,
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
});
