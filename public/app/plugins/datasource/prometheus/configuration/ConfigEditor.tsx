import React from 'react';
import { AlertingSettings, DataSourceHttpSettings } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { config } from 'app/core/config';
import { PromOptions } from '../types';
import { AzureAuthSettings } from './AzureAuthSettings';
import { PromSettings } from './PromSettings';

export type Props = DataSourcePluginOptionsEditorProps<PromOptions>;
export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;

  const azureAuthSettings = {
    azureAuthEnabled: config.featureToggles['prometheus_azure_auth'] ?? false,
    azureSettingsUI: AzureAuthSettings,
  };

  return (
    <>
      <DataSourceHttpSettings
        defaultUrl="http://localhost:9090"
        dataSourceConfig={options}
        showAccessOptions={true}
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={config.sigV4AuthEnabled}
        azureAuthSettings={azureAuthSettings}
      />

      <AlertingSettings<PromOptions> options={options} onOptionsChange={onOptionsChange} />

      <PromSettings options={options} onOptionsChange={onOptionsChange} />
    </>
  );
};
