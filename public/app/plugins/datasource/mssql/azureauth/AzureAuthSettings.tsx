import { useMemo } from 'react';
import { useEffectOnce } from 'react-use';

import { AzureCredentials, AzureCloud, updateDatasourceCredentials } from '@grafana/azure-sdk';
import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { HttpSettingsBaseProps } from '@grafana/ui/src/components/DataSourceSettings/types';

import { getCredentials } from './AzureCredentialsConfig';
import { AzureCredentialsForm } from './AzureCredentialsForm';

export const KnownAzureClouds: Array<SelectableValue<AzureCloud>> = [{ value: AzureCloud.Public, label: 'Azure' }];

export const AzureAuthSettings = (props: HttpSettingsBaseProps) => {
  const { dataSourceConfig: dsSettings, onChange } = props;
  const managedIdentityEnabled = config.azure.managedIdentityEnabled;
  const azureEntraPasswordCredentialsEnabled = config.azure.azureEntraPasswordCredentialsEnabled;

  const credentials = useMemo(() => getCredentials(dsSettings), [dsSettings]);

  const onCredentialsChange = (credentials: AzureCredentials): void => {
    onChange(updateDatasourceCredentials(dsSettings, credentials));
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
