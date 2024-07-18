import { useMemo } from 'react';
import { useEffectOnce } from 'react-use';

import { config } from '@grafana/runtime';
import { HttpSettingsBaseProps } from '@grafana/ui/src/components/DataSourceSettings/types';

import { AzureCredentialsType } from '../types';

import { KnownAzureClouds } from './AzureCredentials';
import { getCredentials, updateCredentials } from './AzureCredentialsConfig';
import { AzureCredentialsForm } from './AzureCredentialsForm';

export const AzureAuthSettings = (props: HttpSettingsBaseProps) => {
  const { dataSourceConfig: dsSettings, onChange } = props;
  const managedIdentityEnabled = config.azure.managedIdentityEnabled;
  const azureEntraPasswordCredentialsEnabled = config.azure.azureEntraPasswordCredentialsEnabled;

  const credentials = useMemo(() => getCredentials(dsSettings, config), [dsSettings]);

  const onCredentialsChange = (credentials: AzureCredentialsType): void => {
    onChange(updateCredentials(dsSettings, config, credentials));
  };

  // The auth type needs to be set on the first load of the data source
  useEffectOnce(() => {
    if (!dsSettings.jsonData.authType) {
      onCredentialsChange(credentials);
    }
  });

  return (
    <AzureCredentialsForm
      managedIdentityEnabled={managedIdentityEnabled}
      azureEntraPasswordCredentialsEnabled={azureEntraPasswordCredentialsEnabled}
      credentials={credentials}
      azureCloudOptions={KnownAzureClouds}
      onCredentialsChange={onCredentialsChange}
      disabled={dsSettings.readOnly}
    />
  );
};

export default AzureAuthSettings;
