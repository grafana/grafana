import React, { FunctionComponent, useMemo } from 'react';
import { InlineFormLabel, Input } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { KnownAzureClouds, AzureCredentials } from './AzureCredentials';
import { getCredentials, updateCredentials } from './AzureCredentialsConfig';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { HttpSettingsBaseProps } from '@grafana/ui/src/components/DataSourceSettings/types';

export const AzureAuthSettings: FunctionComponent<HttpSettingsBaseProps> = (props: HttpSettingsBaseProps) => {
  const { dataSourceConfig, onChange } = props;

  const credentials = useMemo(() => getCredentials(dataSourceConfig), [dataSourceConfig]);

  const onCredentialsChange = (credentials: AzureCredentials): void => {
    onChange(updateCredentials(dataSourceConfig, credentials));
  };

  return (
    <>
      <h6>Azure Authentication</h6>
      <AzureCredentialsForm
        managedIdentityEnabled={config.azure.managedIdentityEnabled}
        credentials={credentials}
        azureCloudOptions={KnownAzureClouds}
        onCredentialsChange={onCredentialsChange}
      />
      <h6>Azure Configuration</h6>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel className="width-12">AAD resource ID</InlineFormLabel>
            <div className="width-15">
              <Input
                className="width-30"
                value={dataSourceConfig.jsonData.azureEndpointResourceId || ''}
                onChange={(event) =>
                  onChange({
                    ...dataSourceConfig,
                    jsonData: { ...dataSourceConfig.jsonData, azureEndpointResourceId: event.currentTarget.value },
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AzureAuthSettings;
