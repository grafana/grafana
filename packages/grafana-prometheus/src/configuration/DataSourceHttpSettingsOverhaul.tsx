// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/configuration/DataSourceHttpSettingsOverhaul.tsx
import { DataSourceSettings } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Auth, AuthMethod, ConnectionSettings, convertLegacyAuthProps } from '@grafana/plugin-ui';
import { SecureSocksProxySettings, useTheme2 } from '@grafana/ui';

import { PromOptions } from '../types';

import { docsTip, overhaulStyles } from './shared/utils';

type DataSourceHttpSettingsProps = {
  options: DataSourceSettings<PromOptions, {}>;
  onOptionsChange: (options: DataSourceSettings<PromOptions, {}>) => void;
  secureSocksDSProxyEnabled: boolean;
};

export const DataSourceHttpSettingsOverhaul = (props: DataSourceHttpSettingsProps) => {
  const { options, onOptionsChange, secureSocksDSProxyEnabled } = props;

  const newAuthProps = convertLegacyAuthProps({
    config: options,
    onChange: onOptionsChange,
  });

  const theme = useTheme2();
  const styles = overhaulStyles(theme);

  function returnSelectedMethod() {
    return newAuthProps.selectedMethod;
  }

  // Do we need this switch anymore? Update the language.
  let urlTooltip;
  switch (options.access) {
    case 'direct':
      urlTooltip = (
        <>
          <Trans i18nKey="grafana-prometheus.configuration.data-source-http-settings-overhaul.tooltip-browser-access-mode">
            Your access method is <em>Browser</em>, this means the URL needs to be accessible from the browser.
          </Trans>
          {docsTip()}
        </>
      );
      break;
    case 'proxy':
      urlTooltip = (
        <>
          <Trans i18nKey="grafana-prometheus.configuration.data-source-http-settings-overhaul.tooltip-server-access-mode">
            Your access method is <em>Server</em>, this means the URL needs to be accessible from the grafana
            backend/server.
          </Trans>
          {docsTip()}
        </>
      );
      break;
    default:
      urlTooltip = (
        <>
          <Trans
            i18nKey="grafana-prometheus.configuration.data-source-http-settings-overhaul.tooltip-http-url"
            values={{ exampleURL: 'http://your_server:8080' }}
          >
            Specify a complete HTTP URL (for example {'{{exampleURL}}'})
          </Trans>
          {docsTip()}
        </>
      );
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
      <Auth
        // Reshaped legacy props
        {...newAuthProps}
        // Still need to call `onAuthMethodSelect` function from
        // `newAuthProps` to store the legacy data correctly.
        // Also make sure to store the data about your component
        // being selected/unselected.
        onAuthMethodSelect={(method) => {
          // Clean up SigV4 properties when switching away from SigV4 auth
          let updatedJsonData = {
            ...options.jsonData,
            oauthPassThru: method === AuthMethod.OAuthForward,
            sigV4Auth: false,
          };
          
          let updatedSecureJsonData = { ...options.secureJsonData };

          // Remove CRITICAL SigV4 properties (hardcoded for security)
          delete (updatedJsonData as any)['assumeRoleArn'];  // Role ARN - allows role assumption
          delete (updatedJsonData as any)['externalId'];     // External ID - cross-account security token
          
          // Remove CRITICAL secureJsonData properties (hardcoded for security)
          delete (updatedSecureJsonData as any)['accessKey'];     // AWS Access Key ID - CRITICAL
          delete (updatedSecureJsonData as any)['secretKey'];     // AWS Secret Access Key - CRITICAL  
          delete (updatedSecureJsonData as any)['sessionToken'];  // AWS Session Token - CRITICAL
          
          // Remove any sigV4* prefixed secure properties (all are sensitive)
          Object.keys(updatedSecureJsonData).forEach(key => {
            if (key.startsWith('sigV4')) {
              delete (updatedSecureJsonData as any)[key];
            }
          });

          onOptionsChange({
            ...options,
            basicAuth: method === AuthMethod.BasicAuth,
            withCredentials: method === AuthMethod.CrossSiteCredentials,
            jsonData: updatedJsonData,
            secureJsonData: updatedSecureJsonData,
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
