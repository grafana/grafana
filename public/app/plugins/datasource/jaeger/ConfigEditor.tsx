import {
  DataSourceJsonData,
  DataSourcePluginOptionsEditorProps,
  DataSourceSelectItem,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { DataSourceHttpSettings, InlineField } from '@grafana/ui';
import DataSourcePicker from 'app/core/components/Select/DataSourcePicker';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import React from 'react';

export interface TracesToLogsOptions {
  datasourceUid?: string;
}

export interface JaegerOptions extends DataSourceJsonData {
  tracesToLogs?: TracesToLogsOptions;
}

export type Props = DataSourcePluginOptionsEditorProps<JaegerOptions>;

export const ConfigEditor: React.FC<Props> = ({ options, onOptionsChange }) => {
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
      <DataSourceHttpSettings
        defaultUrl="http://localhost:16686"
        dataSourceConfig={options}
        showAccessOptions={true}
        onChange={onOptionsChange}
      />

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
};
