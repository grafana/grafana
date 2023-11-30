import React, { useState } from 'react';

import { DataSourceSettings } from '@grafana/data';
import { Auth, AuthMethod, ConnectionSettings, convertLegacyAuthProps } from '@grafana/experimental';
import { SecureSocksProxySettings, useTheme2 } from '@grafana/ui';

import { PromOptions } from '../types';

import { docsTip, overhaulStyles } from './ConfigEditor';
import { CustomMethod } from './overhaul/types';

type Props = {
  options: DataSourceSettings<PromOptions, {}>;
  onOptionsChange: (options: DataSourceSettings<PromOptions, {}>) => void;
  sigV4AuthToggleEnabled: boolean | undefined;
  renderSigV4Editor: React.ReactNode;
  secureSocksDSProxyEnabled: boolean;
};

export const DataSourcehttpSettingsOverhaul = (props: Props) => {
  const { options, onOptionsChange, sigV4AuthToggleEnabled, renderSigV4Editor, secureSocksDSProxyEnabled } = props;

  const newAuthProps = convertLegacyAuthProps({
    config: options,
    onChange: onOptionsChange,
  });

  const theme = useTheme2();
  const styles = overhaulStyles(theme);

  // for custom auth methods sigV4
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

  function returnSelectedMethod() {
    if (sigV4Selected) {
      return sigV4Id;
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
      <Auth
        // Reshaped legacy props
        {...newAuthProps}
        // Your custom auth methods
        customMethods={customMethods}
        // Still need to call `onAuthMethodSelect` function from
        // `newAuthProps` to store the legacy data correctly.
        // Also make sure to store the data about your component
        // being selected/unselected.
        onAuthMethodSelect={(method) => {
          // handle selecting of custom methods
          // sigV4Id
          if (sigV4AuthToggleEnabled) {
            setSigV4Selected(method === sigV4Id);
          }

          onOptionsChange({
            ...options,
            basicAuth: method === AuthMethod.BasicAuth,
            withCredentials: method === AuthMethod.CrossSiteCredentials,
            jsonData: {
              ...options.jsonData,
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
