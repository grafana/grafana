import React from 'react';
import { AlertingSettings, DataSourceHttpSettings } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { PromSettings } from './PromSettings';
import { PromOptions } from '../types';
import { config } from 'app/core/config';

export type Props = DataSourcePluginOptionsEditorProps<PromOptions>;
export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;
  return (
    <>
      <DataSourceHttpSettings
        defaultUrl="http://localhost:9090"
        dataSourceConfig={options}
        showAccessOptions={true}
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={config.sigV4AuthEnabled}
      />

      <AlertingSettings<PromOptions> options={options} onOptionsChange={onOptionsChange} />

      <PromSettings options={options} onOptionsChange={onOptionsChange} />
    </>
  );
};
