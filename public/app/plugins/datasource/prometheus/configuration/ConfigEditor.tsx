import React from 'react';
import { AlertingSettings, DataSourceHttpSettings, Alert } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import { config } from 'app/core/config';
import { PromOptions } from '../types';
import { AzureAuthSettings } from './AzureAuthSettings';
import { PromSettings } from './PromSettings';
import { hasCredentials, setDefaultCredentials, resetCredentials } from './AzureCredentialsConfig';
import { getAllAlertmanagerDataSources } from 'app/features/alerting/unified/utils/alertmanager';

export type Props = DataSourcePluginOptionsEditorProps<PromOptions>;
export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;
  const alertmanagers = getAllAlertmanagerDataSources();

  const azureAuthSettings = {
    azureAuthSupported: config.featureToggles['prometheus_azure_auth'] ?? false,
    getAzureAuthEnabled: (config: DataSourceSettings<any, any>): boolean => hasCredentials(config),
    setAzureAuthEnabled: (config: DataSourceSettings<any, any>, enabled: boolean) =>
      enabled ? setDefaultCredentials(config) : resetCredentials(config),
    azureSettingsUI: AzureAuthSettings,
  };

  return (
    <>
      {options.access === 'direct' && (
        <Alert title="Deprecation Notice" severity="warning">
          Browser access mode in the Prometheus datasource is deprecated and will be removed in a future release.
        </Alert>
      )}

      <DataSourceHttpSettings
        defaultUrl="http://localhost:9090"
        dataSourceConfig={options}
        showAccessOptions={true}
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={config.sigV4AuthEnabled}
        azureAuthSettings={azureAuthSettings}
      />

      <AlertingSettings<PromOptions>
        alertmanagerDataSources={alertmanagers}
        options={options}
        onOptionsChange={onOptionsChange}
      />

      <PromSettings options={options} onOptionsChange={onOptionsChange} />
    </>
  );
};
