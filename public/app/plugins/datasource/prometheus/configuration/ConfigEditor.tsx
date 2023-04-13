import React, { useRef } from 'react';

import { SIGV4ConnectionConfig } from '@grafana/aws-sdk';
import { DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import { Alert, SecureSocksProxySettings, useTheme2 } from '@grafana/ui';
import { config } from 'app/core/config';

import { PromOptions } from '../types';

import { AlertingSettingsOverhaul } from './AlertingSettingsOverhaul';
import { AzureAuthSettings } from './AzureAuthSettings';
import { hasCredentials, setDefaultCredentials, resetCredentials } from './AzureCredentialsConfig';
import { DataSourceHttpSettingsOverhaul, overhaulStyles } from './DataSourceHttpSettingsOverhaul';
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

  const theme = useTheme2();
  const styles = overhaulStyles(theme);

  return (
    <>
      {options.access === 'direct' && (
        <Alert title="Error" severity="error">
          Browser access mode in the Prometheus data source is no longer available. Switch to server access mode.
        </Alert>
      )}

      <DataSourceHttpSettingsOverhaul
        defaultUrl="http://localhost:9090"
        dataSourceConfig={options}
        showAccessOptions={showAccessOptions.current}
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={config.sigV4AuthEnabled}
        azureAuthSettings={azureAuthSettings}
        renderSigV4Editor={<SIGV4ConnectionConfig {...props}></SIGV4ConnectionConfig>}
      />

      {config.featureToggles.secureSocksDatasourceProxy && (
        <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
      )}
      <>
        <hr />
        <h3 className={styles.sectionHeaderPadding}>Additional Settings</h3>
        <p className={`${styles.secondaryGrey} ${styles.subsectionText}`}>
          Additional settings are optional settings that can be configured for more control over your data source.
        </p>

        <AlertingSettingsOverhaul<PromOptions> options={options} onOptionsChange={onOptionsChange} />

        <PromSettings options={options} onOptionsChange={onOptionsChange} />
      </>
    </>
  );
};
