import { css } from '@emotion/css';
import React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, InlineField, InlineFieldRow, Input, useStyles } from '@grafana/ui';

export interface TraceToMetricsOptions {
  datasourceUid?: string;
  query: string;
}

export interface TraceToMetricsData extends DataSourceJsonData {
  tracesToMetrics?: TraceToMetricsOptions;
}

interface Props extends DataSourcePluginOptionsEditorProps<TraceToMetricsData> {}

export function TraceToMetricsSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles(getStyles);

  return (
    <div className={css({ width: '100%' })}>
      <h3 className="page-heading">Trace to metrics</h3>

      <div className={styles.infoText}>
        Trace to metrics lets you navigate from a trace span to the selected data source.
      </div>

      <InlineFieldRow className={styles.row}>
        <InlineField tooltip="The data source the trace is going to navigate to" label="Data source" labelWidth={26}>
          <DataSourcePicker
            inputId="trace-to-metrics-data-source-picker"
            pluginId="prometheus"
            current={options.jsonData.tracesToMetrics?.datasourceUid}
            noDefault={true}
            width={40}
            onChange={(ds) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', {
                ...options.jsonData.tracesToMetrics,
                datasourceUid: ds.uid,
              })
            }
          />
        </InlineField>
        {options.jsonData.tracesToMetrics?.datasourceUid ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            fill="text"
            onClick={() => {
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', {
                ...options.jsonData.tracesToMetrics,
                datasourceUid: undefined,
              });
            }}
          >
            Clear
          </Button>
        ) : null}
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          label="Query"
          labelWidth={26}
          tooltip="The Prometheus query that will run when navigating from a trace to metrics"
          grow
        >
          <Input
            label="Query"
            type="text"
            allowFullScreen
            value={options.jsonData.tracesToMetrics?.query}
            onChange={(e) => {
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', {
                ...options.jsonData.tracesToMetrics,
                query: e.currentTarget.value,
              });
            }}
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme) => ({
  infoText: css`
    padding-bottom: ${theme.spacing.md};
    color: ${theme.colors.textSemiWeak};
  `,
  row: css`
    label: row;
    align-items: baseline;
  `,
});
