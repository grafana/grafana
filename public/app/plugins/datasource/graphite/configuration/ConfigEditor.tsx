import React from 'react';
import { DataSourceHttpSettings } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { GraphiteDetails } from './GraphiteDetails';
import { GraphiteOptions } from '../types';

export const ConfigEditor = (props: DataSourcePluginOptionsEditorProps<GraphiteOptions>) => {
  const { options, onOptionsChange } = props;

  return (
    <>
      <DataSourceHttpSettings
        defaultUrl="http://localhost:8080"
        dataSourceConfig={options}
        onChange={onOptionsChange}
      />
      <GraphiteDetails value={options} onChange={onOptionsChange} />
    </>
  );
};
