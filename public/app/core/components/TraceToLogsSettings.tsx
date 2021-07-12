import { css } from '@emotion/css';
import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { InlineField, InlineFieldRow, Input, TagsInput, useStyles } from '@grafana/ui';
import React from 'react';

export interface TraceToLogsOptions {
  datasourceUid?: string;
  tags?: string[];
  spanStartTimeShift?: string;
  spanEndTimeShift?: string;
}

export interface TraceToLogsData extends DataSourceJsonData {
  tracesToLogs?: TraceToLogsOptions;
}

interface Props extends DataSourcePluginOptionsEditorProps<TraceToLogsData> {}

export function TraceToLogsSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles(getStyles);

  return (
    <div className={css({ width: '100%' })}>
      <h3 className="page-heading">Trace to logs</h3>

      <div className={styles.infoText}>
        Trace to logs let&apos;s you navigate from a trace span to the selected data source&apos;s log.
      </div>

      <InlineFieldRow>
        <InlineField tooltip="The data source the trace is going to navigate to" label="Data source" labelWidth={26}>
          <DataSourcePicker
            pluginId="loki"
            current={options.jsonData.tracesToLogs?.datasourceUid}
            noDefault={true}
            width={40}
            onChange={(ds) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToLogs', {
                datasourceUid: ds.uid,
                tags: options.jsonData.tracesToLogs?.tags,
              })
            }
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          tooltip="Tags that will be used in the Loki query. Default tags: 'cluster', 'hostname', 'namespace', 'pod'"
          label="Tags"
          labelWidth={26}
        >
          <TagsInput
            tags={options.jsonData.tracesToLogs?.tags}
            width={40}
            onChange={(tags) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToLogs', {
                datasourceUid: options.jsonData.tracesToLogs?.datasourceUid,
                tags: tags,
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
          tooltip="Shifts the start time of the span. Default 0 (Time units can be used here, for example: 5s, 1m, 3h)"
        >
          <Input
            type="text"
            placeholder="1h"
            width={40}
            onChange={(v) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToLogs', {
                ...options.jsonData.tracesToLogs,
                spanStartTimeShift: v.currentTarget.value,
              })
            }
            value={options.jsonData.tracesToLogs?.spanStartTimeShift || ''}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          label="Span end time shift"
          labelWidth={26}
          grow
          tooltip="Shifts the end time of the span. Default 0 Time units can be used here, for example: 5s, 1m, 3h"
        >
          <Input
            type="text"
            placeholder="1h"
            width={40}
            onChange={(v) =>
              updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToLogs', {
                ...options.jsonData.tracesToLogs,
                spanEndTimeShift: v.currentTarget.value,
              })
            }
            value={options.jsonData.tracesToLogs?.spanEndTimeShift || ''}
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
});
