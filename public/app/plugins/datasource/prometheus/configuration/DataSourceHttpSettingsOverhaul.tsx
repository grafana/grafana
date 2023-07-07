import React, { useState } from 'react';

import { DataSourceSettings } from '@grafana/data';
import { Auth, convertLegacyAuthProps } from '@grafana/experimental';
import { CustomMethod } from '@grafana/experimental/dist/ConfigEditor/Auth/types';
import { SecureSocksProxySettings } from '@grafana/ui';
import { AzureAuthSettings } from '@grafana/ui/src/components/DataSourceSettings/types';

import { PromOptions } from '../types';

type Props = {
  options: DataSourceSettings<PromOptions, {}>;
  onOptionsChange: (options: DataSourceSettings<PromOptions, {}>) => void;
  azureAuthSettings: AzureAuthSettings;
  sigV4AuthToggleEnabled: boolean | undefined;
  renderSigV4Editor: React.ReactNode;
  secureSocksDSProxyEnabled: boolean;
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
    description: 'This is Azure auth description',
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

  return (
    <>
      {/* NEED TO ADD <ConnectionSettings
        config={props.options}
        onChange={props.onOptionsChange}
      /> */}

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
          newAuthProps.onAuthMethodSelect(method);

          // handle selecting of custom methods
          setSigV4Selected(method === sigV4Id);

          setAzureAuthSelected(method === azureAuthId);
          azureAuthSettings.setAzureAuthEnabled(options, method === azureAuthId);
        }}
        // If your method is selected pass its id to `selectedMethod`,
        // otherwise pass the id from converted legacy data
        selectedMethod={returnSelectedMethod()}
      />

      {/* NEED TO ADD BELOW <AdvancedHttpSettings/> */}
      {secureSocksDSProxyEnabled && <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />}
    </>
  );
};
