import { css } from '@emotion/css';
import React from 'react';

import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme2,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { ConfigSection } from '@grafana/experimental';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, InlineField, InlineFieldRow, Input, useStyles2 } from '@grafana/ui';

import { ConfigDescriptionLink } from '../ConfigDescriptionLink';
import { IntervalInput } from '../IntervalInput/IntervalInput';
import { TagMappingInput } from '../TraceToLogs/TagMappingInput';
import { getTimeShiftLabel, getTimeShiftTooltip, invalidTimeShiftError } from '../TraceToLogs/TraceToLogsSettings';

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

      <IntervalInput
        label={getTimeShiftLabel('start')}
        tooltip={getTimeShiftTooltip('start')}
        value={options.jsonData.tracesToMetrics?.spanStartTimeShift || ''}
        onChange={(val) => {
          updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', {
            ...options.jsonData.tracesToMetrics,
            spanStartTimeShift: val,
          });
        }}
        isInvalidError={invalidTimeShiftError}
      />

      <IntervalInput
        label={getTimeShiftLabel('end')}
        tooltip={getTimeShiftTooltip('end')}
        value={options.jsonData.tracesToMetrics?.spanEndTimeShift || ''}
        onChange={(val) => {
          updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToMetrics', {
            ...options.jsonData.tracesToMetrics,
            spanEndTimeShift: val,
          });
        }}
        isInvalidError={invalidTimeShiftError}
      />

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

      {options.jsonData.tracesToMetrics?.queries?.map((query, i) => (
        <div key={i} className={styles.queryRow}>
          <InlineField label="Link Label" labelWidth={26} tooltip="Descriptive label for the linked query">
            <Input
              label="Link Label"
              type="text"
              allowFullScreen
              value={query.name}
              width={40}
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

export const TraceToMetricsSection = ({ options, onOptionsChange }: DataSourcePluginOptionsEditorProps) => {
  return (
    <ConfigSection
      title="Trace to metrics"
      description={
        <ConfigDescriptionLink
          description="Navigate from a trace span to the selected data source's metrics."
          suffix={`${options.type}/#trace-to-metrics`}
          feature="trace to metrics"
        />
      }
      isCollapsible={true}
      isInitiallyOpen={true}
    >
      <TraceToMetricsSettings options={options} onOptionsChange={onOptionsChange} />
    </ConfigSection>
  );
};

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
    label: queryRow;
    display: flex;
    flex-flow: wrap;
  `,
});
