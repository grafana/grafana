import { ReactElement, useState } from 'react';
import * as React from 'react';

import { Auth, ConnectionSettings, convertLegacyAuthProps, AuthMethod } from '@grafana/plugin-ui';
import { docsTip, overhaulStyles } from '@grafana/prometheus';
import { Alert, SecureSocksProxySettings, useTheme2 } from '@grafana/ui';
// NEED TO EXPORT THIS FROM GRAFANA/UI FOR EXTERNAL DS
import { AzureAuthSettings } from '@grafana/ui/src/components/DataSourceSettings/types';

import { AzurePromDataSourceSettings } from './AzureCredentialsConfig';

type Props = {
  options: AzurePromDataSourceSettings;
  onOptionsChange: (options: AzurePromDataSourceSettings) => void;
  azureAuthSettings: AzureAuthSettings;
  sigV4AuthToggleEnabled: boolean | undefined;
  renderSigV4Editor: React.ReactNode;
  secureSocksDSProxyEnabled: boolean;
};

// these are not available yet in grafana
export type CustomMethodId = `custom-${string}`;

export type CustomMethod = {
  id: CustomMethodId;
  label: string;
  description: string;
  component: ReactElement;
};

export const DataSourcehttpSettingsOverhaul = (props: Props) => {
  const {
    options,
    onOptionsChange,
    azureAuthSettings,
    sigV4AuthToggleEnabled,
    renderSigV4Editor,
    secureSocksDSProxyEnabled,
  } = props;

  const newAuthProps = convertLegacyAuthProps({
    config: options,
    onChange: onOptionsChange,
  });

  const theme = useTheme2();
  const styles = overhaulStyles(theme);

  // for custom auth methods sigV4 and azure auth
  let customMethods: CustomMethod[] = [];

  const [sigV4Selected, setSigV4Selected] = useState<boolean>(options.jsonData.sigV4Auth || false);

  const sigV4Id = 'custom-sigV4Id';

  const sigV4Option: CustomMethod = {
    id: sigV4Id,
    label: 'SigV4 auth',
    description: 'This is SigV4 auth description',
    component: <>{renderSigV4Editor}</>,
  };

  if (sigV4AuthToggleEnabled) {
    customMethods.push(sigV4Option);
  }

  const azureAuthEnabled: boolean =
    (azureAuthSettings?.azureAuthSupported && azureAuthSettings.getAzureAuthEnabled(options)) || false;

  const [azureAuthSelected, setAzureAuthSelected] = useState<boolean>(azureAuthEnabled);

  const azureAuthId = 'custom-azureAuthId';

  const azureAuthOption: CustomMethod = {
    id: azureAuthId,
    label: 'Azure auth',
    description: 'Authenticate with Azure',
    component: (
      <>
        {azureAuthSettings.azureSettingsUI && (
          <azureAuthSettings.azureSettingsUI dataSourceConfig={options} onChange={onOptionsChange} />
        )}
      </>
    ),
  };

  // allow the option to show in the dropdown
  if (azureAuthSettings?.azureAuthSupported) {
    customMethods.push(azureAuthOption);
  }

  function returnSelectedMethod() {
    if (sigV4Selected) {
      return sigV4Id;
    }

    if (azureAuthSelected) {
      return azureAuthId;
    }

    return newAuthProps.selectedMethod;
  }

  // Do we need this switch anymore? Update the language.
  let urlTooltip;
  switch (options.access) {
    case 'direct':
      urlTooltip = (
        <>
          Your access method is <em>Browser</em>, this means the URL needs to be accessible from the browser.
          {docsTip()}
        </>
      );
      break;
    case 'proxy':
      urlTooltip = (
        <>
          Your access method is <em>Server</em>, this means the URL needs to be accessible from the grafana
          backend/server.
          {docsTip()}
        </>
      );
      break;
    default:
      urlTooltip = <>Specify a complete HTTP URL (for example http://your_server:8080) {docsTip()}</>;
  }

  return (
    <>
      <ConnectionSettings
        urlPlaceholder="http://localhost:9090"
        config={options}
        onChange={onOptionsChange}
        urlLabel="Prometheus server URL"
        urlTooltip={urlTooltip}
      />
      <hr className={`${styles.hrTopSpace} ${styles.hrBottomSpace}`} />
      {sigV4Selected && (
        <Alert title="Deprecation Notice" severity="warning">
          The SigV4 authentication in the core Prometheus data source is deprecated. Please use the Amazon Managed
          Service for Prometheus data source to authenticate with SigV4.
        </Alert>
      )}
      <Auth
        {...newAuthProps}
        customMethods={customMethods}
        onAuthMethodSelect={(method) => {
          // sigV4Id
          if (sigV4AuthToggleEnabled) {
            setSigV4Selected(method === sigV4Id);
          }

          // Azure
          if (azureAuthSettings?.azureAuthSupported) {
            setAzureAuthSelected(method === azureAuthId);
            azureAuthSettings.setAzureAuthEnabled(options, method === azureAuthId);
          }

          onOptionsChange({
            ...options,
            basicAuth: method === AuthMethod.BasicAuth,
            withCredentials: method === AuthMethod.CrossSiteCredentials,
            jsonData: {
              ...options.jsonData,
              azureCredentials: method === azureAuthId ? options.jsonData.azureCredentials : undefined,
              sigV4Auth: method === sigV4Id,
              oauthPassThru: method === AuthMethod.OAuthForward,
            },
          });
        }}
        // If your method is selected pass its id to `selectedMethod`,
        // otherwise pass the id from converted legacy data
        selectedMethod={returnSelectedMethod()}
      />
      <div className={styles.sectionBottomPadding} />
      {secureSocksDSProxyEnabled && (
        <>
          <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
          <div className={styles.sectionBottomPadding} />
        </>
      )}
    </>
  );
};
