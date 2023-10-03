import React, { useMemo } from 'react';

import { config } from '@grafana/runtime';
import { HttpSettingsBaseProps } from '@grafana/ui/src/components/DataSourceSettings/types';

import { AzureCredentialsType } from '../types';

import { KnownAzureClouds } from './AzureCredentials';
import { getCredentials, updateCredentials } from './AzureCredentialsConfig';
import { AzureCredentialsForm } from './AzureCredentialsForm';

export const AzureAuthSettings = (props: HttpSettingsBaseProps) => {
  const { dataSourceConfig: dsSettings, onChange } = props;
  const managedIdentityEnabled = config.azure.managedIdentityEnabled;

  const credentials = useMemo(() => getCredentials(dsSettings, config), [dsSettings]);

  const onCredentialsChange = (credentials: AzureCredentialsType): void => {
    onChange(updateCredentials(dsSettings, config, credentials));
  };

  return (
    <AzureCredentialsForm
      managedIdentityEnabled={managedIdentityEnabled}
      credentials={credentials}
      azureCloudOptions={KnownAzureClouds}
      onCredentialsChange={onCredentialsChange}
      disabled={dsSettings.readOnly}
    />
  );
};

export default AzureAuthSettings;
