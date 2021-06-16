import React, { FunctionComponent, useMemo } from 'react';
import { DataSourceSettings } from '@grafana/data';
import { AzureSettings } from './types';
import { KnownAzureClouds, AzureCredentials } from './AzureCredentials';
import { getCredentials, updateCredentials } from './AzureCredentialsConfig';
import { AzureCredentialsForm } from './AzureCredentialsForm';

export interface Props {
  dataSourceConfig: DataSourceSettings<any, any>;
  onChange: (config: DataSourceSettings) => void;
  azureSettings: AzureSettings;
}

export const AzureAuthSettings: FunctionComponent<Props> = (props: Props) => {
  const { dataSourceConfig, onChange, azureSettings } = props;

  const credentials = useMemo(() => getCredentials(dataSourceConfig, azureSettings), [dataSourceConfig]);

  const onCredentialsChange = (credentials: AzureCredentials): void => {
    onChange(updateCredentials(dataSourceConfig, credentials, azureSettings));
  };

  return (
    <>
      <h6>Azure Authentication</h6>
      <div className="gf-form-group">
        <AzureCredentialsForm
          managedIdentityEnabled={azureSettings.managedIdentityEnabled}
          credentials={credentials}
          azureCloudOptions={KnownAzureClouds}
          onCredentialsChange={onCredentialsChange}
        />
      </div>
    </>
  );
};

export default AzureAuthSettings;
