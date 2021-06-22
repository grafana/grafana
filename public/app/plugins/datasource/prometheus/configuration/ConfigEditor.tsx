import React from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { PromSettings } from './PromSettings';
import { PromOptions } from '../types';
import { config } from 'app/core/config';
import { PrometheusHttpSettings } from './PrometheusHttpSettings';

export type Props = DataSourcePluginOptionsEditorProps<PromOptions>;
export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;
  return (
    <>
      <PrometheusHttpSettings
        defaultUrl="http://localhost:9090"
        dataSourceConfig={options}
        showAccessOptions={true}
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={config.sigV4AuthEnabled}
      />

      <PromSettings options={options} onOptionsChange={onOptionsChange} />
    </>
  );
};
