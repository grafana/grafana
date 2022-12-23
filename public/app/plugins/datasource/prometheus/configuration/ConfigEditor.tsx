import React, { useRef } from 'react';

import { SIGV4ConnectionConfig } from '@grafana/aws-sdk';
import {
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
  onUpdateDatasourceJsonDataOptionChecked,
} from '@grafana/data';
import { AlertingSettings, DataSourceHttpSettings, Alert, InlineField, InlineSwitch } from '@grafana/ui';
import { config } from 'app/core/config';

import { PromOptions } from '../types';

import { AzureAuthSettings } from './AzureAuthSettings';
import { hasCredentials, setDefaultCredentials, resetCredentials } from './AzureCredentialsConfig';
import { PromSettings } from './PromSettings';

export type Props = DataSourcePluginOptionsEditorProps<PromOptions>;
export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;
  // use ref so this is evaluated only first time it renders and the select does not disappear suddenly.
  const showAccessOptions = useRef(props.options.access === 'direct');

  const azureAuthSettings = {
    azureAuthSupported: config.azureAuthEnabled,
    getAzureAuthEnabled: (config: DataSourceSettings<any, any>): boolean => hasCredentials(config),
    setAzureAuthEnabled: (config: DataSourceSettings<any, any>, enabled: boolean) =>
      enabled ? setDefaultCredentials(config) : resetCredentials(config),
    azureSettingsUI: AzureAuthSettings,
  };

  const socksProxy = config.featureToggles.secureSocksDatasourceProxy;

  return (
    <>
      {options.access === 'direct' && (
        <Alert title="Error" severity="error">
          Browser access mode in the Prometheus datasource is no longer available. Switch to server access mode.
        </Alert>
      )}

      <DataSourceHttpSettings
        defaultUrl="http://localhost:9090"
        dataSourceConfig={options}
        showAccessOptions={showAccessOptions.current}
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={config.sigV4AuthEnabled}
        azureAuthSettings={azureAuthSettings}
        renderSigV4Editor={<SIGV4ConnectionConfig {...props}></SIGV4ConnectionConfig>}
      />

      {socksProxy && (
        <>
          <h3 className="page-heading">Secure Socks Proxy</h3>
          <div className="gf-form-group">
            <div className="gf-form-inline"></div>
            <InlineField
              labelWidth={28}
              label="Enabled"
              tooltip="Connect to this datasource via the secure socks proxy."
            >
              <InlineSwitch
                value={options.jsonData.enableSecureSocksProxy ?? false}
                onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'enableSecureSocksProxy')}
              />
            </InlineField>
          </div>
        </>
      )}

      <AlertingSettings<PromOptions> options={options} onOptionsChange={onOptionsChange} />

      <PromSettings options={options} onOptionsChange={onOptionsChange} />
    </>
  );
};
