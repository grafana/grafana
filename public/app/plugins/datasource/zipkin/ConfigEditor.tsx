import React from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { DataSourceHttpSettings } from '@grafana/ui';

export type Props = DataSourcePluginOptionsEditorProps;

export const ConfigEditor: React.FC<Props> = ({ options, onOptionsChange }) => {
  return (
    <DataSourceHttpSettings
      defaultUrl={'http://localhost:9411'}
      dataSourceConfig={options}
      showAccessOptions={true}
      onChange={onOptionsChange}
    />
  );
};
