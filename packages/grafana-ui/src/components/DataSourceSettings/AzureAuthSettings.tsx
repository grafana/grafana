import React, { FunctionComponent, useMemo } from 'react';
import { HttpSettingsBaseProps } from './types';
import { KnownAzureClouds, AzureCredentials } from './AzureCredentials';
import { getCredentials, updateCredentials } from './AzureCredentialsConfig';
import { AzureCredentialsForm } from './AzureCredentialsForm';

export interface Props extends HttpSettingsBaseProps {}

const config = {
  azure: {
    managedIdentityEnabled: true,
  },
};

export const AzureAuthSettings: FunctionComponent<Props> = (props: Props) => {
  const { dataSourceConfig, onChange } = props;

  const credentials = useMemo(() => getCredentials(dataSourceConfig), [dataSourceConfig]);

  const onCredentialsChange = (credentials: AzureCredentials): void => {
    onChange(updateCredentials(dataSourceConfig, credentials));
  };

  return (
    <>
      <h6>Azure Authentication</h6>
      <div className="gf-form-group">
        <AzureCredentialsForm
          managedIdentityEnabled={config.azure.managedIdentityEnabled}
          credentials={credentials}
          azureCloudOptions={KnownAzureClouds}
          onCredentialsChange={onCredentialsChange}
        />
      </div>
    </>
  );
};

export default AzureAuthSettings;
