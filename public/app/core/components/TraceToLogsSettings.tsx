import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  DataSourceSelectItem,
  GrafanaTheme,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { InlineField, useStyles } from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { css } from 'emotion';
import React from 'react';
import { DataSourcePicker } from './Select/DataSourcePicker';

export interface TracesToLogsOptions {
  datasourceUid?: string;
}

export interface TraceToLogsData extends DataSourceJsonData {
  tracesToLogs?: TracesToLogsOptions;
}

interface Props extends DataSourcePluginOptionsEditorProps<TraceToLogsData> {}

export function TraceToLogsSettings({ options, onOptionsChange }: Props) {
  const datasources: DataSourceSelectItem[] = getDatasourceSrv()
    .getExternal()
    .filter(ds => ds.meta.id === 'loki')
    .map(
      ds =>
        ({
          value: ds.uid,
          name: ds.name,
          meta: ds.meta,
        } as DataSourceSelectItem)
    );
  let selectedDatasource = datasources.find(d => d.value === options.jsonData.tracesToLogs?.datasourceUid);

  const styles = useStyles(getStyles);

  return (
    <>
      <h3 className="page-heading">Trace to logs</h3>

      <div className={styles.infoText}>
        Trace to logs let&apos;s you navigate from a trace span to the selected data source&apos;s log.
      </div>

      <InlineField label="Data source" tooltip="The data source the trace is going to navigate to">
        <DataSourcePicker
          datasources={datasources}
          current={selectedDatasource}
          onChange={ds =>
            updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'tracesToLogs', {
              datasourceUid: ds.value!,
            })
          }
        />
      </InlineField>
    </>
  );
}

const getStyles = (theme: GrafanaTheme) => ({
  infoText: css`
    padding-bottom: ${theme.spacing.md};
    color: ${theme.colors.textSemiWeak};
  `,
});
