import { css } from '@emotion/css';
import React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme2,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, InlineField, InlineFieldRow, Input, useStyles2 } from '@grafana/ui';

import { TagMappingInput } from '../TraceToLogs/TagMappingInput';

export interface TraceToMetricsOptions {
  datasourceUid?: string;
  tags?: Array<{ key: string; value: string }>;
  queries: TraceToMetricQuery[];
  spanStartTimeShift?: string;
  spanEndTimeShift?: string;
}

export interface TraceToMetricQuery {
  name?: string;
  query?: string;
}

export interface TraceToMetricsData extends DataSourceJsonData {
  tracesToMetrics?: TraceToMetricsOptions;
}

interface Props extends DataSourcePluginOptionsEditorProps<TraceToMetricsData> {}

export function TraceToMetricsSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={css({ width: '100%' })}>
      <h3 className="page-heading">Trace to metrics</h3>

      <div className={styles.infoText}>Navigate from a trace span to the selected data source&apos;s metrics.</div>

      <InlineFieldRow className={styles.row}>
        <InlineField
          tooltip="The Prometheus data source the trace is going to navigate to"
          label="Data source"
          labelWidth={26}
        >
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
        <InlineField tooltip="Tags that will be used in the metrics query" label="Tags" labelWidth={26}>
          <TagMappingInput
            values={options.jsonData.tracesToMetrics?.tags ?? []}
            onChange={(v) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', {
                ...options.jsonData.tracesToMetrics,
                tags: v,
              })
            }
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          label="Span start time shift"
          labelWidth={26}
          grow
          tooltip="Shifts the start time of the span. Default: 0 (Time units can be used here, for example: 5s, 1m, 3h)"
        >
          <Input
            type="text"
            placeholder="-1h"
            width={40}
            onChange={(v) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', {
                ...options.jsonData.tracesToMetrics,
                spanStartTimeShift: v.currentTarget.value,
              })
            }
            value={options.jsonData.tracesToMetrics?.spanStartTimeShift || ''}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          label="Span end time shift"
          labelWidth={26}
          grow
          tooltip="Shifts the end time of the span. Default: 0 (Time units can be used here, for example: 5s, 1m, 3h)"
        >
          <Input
            type="text"
            placeholder="1h"
            width={40}
            onChange={(v) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', {
                ...options.jsonData.tracesToMetrics,
                spanEndTimeShift: v.currentTarget.value,
              })
            }
            value={options.jsonData.tracesToMetrics?.spanEndTimeShift || ''}
          />
        </InlineField>
      </InlineFieldRow>

      {options.jsonData.tracesToMetrics?.queries?.map((query, i) => (
        <div key={i} className={styles.queryRow}>
          <InlineField label="Link Label" labelWidth={10}>
            <Input
              label="Link Label"
              type="text"
              allowFullScreen
              value={query.name}
              onChange={(e) => {
                let newQueries = options.jsonData.tracesToMetrics?.queries.slice() ?? [];
                newQueries[i].name = e.currentTarget.value;
                updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', {
                  ...options.jsonData.tracesToMetrics,
                  queries: newQueries,
                });
              }}
            />
          </InlineField>
          <InlineField
            label="Query"
            labelWidth={10}
            tooltip="The Prometheus query that will run when navigating from a trace to metrics. Interpolate tags using the `$__tags` keyword"
            grow
          >
            <Input
              label="Query"
              type="text"
              allowFullScreen
              value={query.query}
              onChange={(e) => {
                let newQueries = options.jsonData.tracesToMetrics?.queries.slice() ?? [];
                newQueries[i].query = e.currentTarget.value;
                updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', {
                  ...options.jsonData.tracesToMetrics,
                  queries: newQueries,
                });
              }}
            />
          </InlineField>

          <Button
            variant="destructive"
            title="Remove query"
            icon="times"
            type="button"
            onClick={() => {
              let newQueries = options.jsonData.tracesToMetrics?.queries.slice();
              newQueries?.splice(i, 1);
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', {
                ...options.jsonData.tracesToMetrics,
                queries: newQueries,
              });
            }}
          />
        </div>
      ))}

      <Button
        variant="secondary"
        title="Add query"
        icon="plus"
        type="button"
        onClick={() => {
          updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', {
            ...options.jsonData.tracesToMetrics,
            queries: [...(options.jsonData.tracesToMetrics?.queries ?? []), { query: '' }],
          });
        }}
      >
        Add query
      </Button>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  infoText: css`
    padding-bottom: ${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
  `,
  row: css`
    label: row;
    align-items: baseline;
  `,
  queryRow: css`
    display: flex;
  `,
});
