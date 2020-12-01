import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  DataSourceSelectItem,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { InlineField } from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
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
  return (
    <>
      <h3 className="page-heading">Trace to logs</h3>

      <InlineField label="Data source">
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
