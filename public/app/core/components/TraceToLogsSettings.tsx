import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { InlineFormLabel, TagsInput, useStyles } from '@grafana/ui';
import { css } from 'emotion';
import React from 'react';
import { DataSourcePicker } from './Select/DataSourcePicker';

export interface TraceToLogsOptions {
  datasourceUid?: string;
  tags?: string[];
}

export interface TraceToLogsData extends DataSourceJsonData {
  tracesToLogs?: TraceToLogsOptions;
}

interface Props extends DataSourcePluginOptionsEditorProps<TraceToLogsData> {}

export function TraceToLogsSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles(getStyles);

  return (
    <>
      <h3 className="page-heading">Trace to logs</h3>

      <div className={styles.infoText}>
        Trace to logs let&apos;s you navigate from a trace span to the selected data source&apos;s log.
      </div>

      <div className="gf-form">
        <InlineFormLabel tooltip="The data source the trace is going to navigate to">Data source</InlineFormLabel>
        <DataSourcePicker
          pluginId="loki"
          current={options.jsonData.tracesToLogs?.datasourceUid}
          noDefault={true}
          onChange={(ds) =>
            updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToLogs', {
              datasourceUid: ds.uid,
              tags: options.jsonData.tracesToLogs?.tags,
            })
          }
        />
      </div>

      <div className="gf-form">
        <InlineFormLabel tooltip="Tags that will be used in the Loki query. Default tags: 'cluster', 'hostname', 'namespace', 'pod'">
          Tags
        </InlineFormLabel>
        <TagsInput
          tags={options.jsonData.tracesToLogs?.tags}
          onChange={(tags) =>
            updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToLogs', {
              datasourceUid: options.jsonData.tracesToLogs?.datasourceUid,
              tags: tags,
            })
          }
        />
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme) => ({
  infoText: css`
    padding-bottom: ${theme.spacing.md};
    color: ${theme.colors.textSemiWeak};
  `,
});
