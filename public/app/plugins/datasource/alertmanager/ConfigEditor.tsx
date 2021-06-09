import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { Alert, DataSourceHttpSettings } from '@grafana/ui';
import React from 'react';

export type Props = DataSourcePluginOptionsEditorProps;

export const ConfigEditor: React.FC<Props> = ({ options, onOptionsChange }) => {
  return (
    <>
      <Alert severity="info" title="Only Cortex alertmanager is supported">
        Note that only Cortex implementation of alert manager is supported at this time.
      </Alert>
      <DataSourceHttpSettings
        defaultUrl={''}
        dataSourceConfig={options}
        showAccessOptions={true}
        onChange={onOptionsChange}
      />
    </>
  );
};
