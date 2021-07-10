import React, { FunctionComponent, useMemo } from 'react';
import { DataSourceSettings } from '@grafana/data';
import { InlineFormLabel, Input } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { KnownAzureClouds, AzureCredentials } from './AzureCredentials';
import { getCredentials, updateCredentials } from './AzureCredentialsConfig';
import { AzureCredentialsForm } from './AzureCredentialsForm';

export interface Props {
  dataSourceConfig: DataSourceSettings<any, any>;
  onChange: (config: DataSourceSettings) => void;
}

export const AzureAuthSettings: FunctionComponent<Props> = (props: Props) => {
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
      <h6>Azure Prometheus Configuration</h6>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel className="width-12">AAD resource ID</InlineFormLabel>
            <div className="width-15">
              <Input
                className="width-30"
                value={dataSourceConfig.jsonData.azurePrometheusResourceId || ''}
                onChange={(event) =>
                  onChange({
                    ...dataSourceConfig,
                    jsonData: { ...dataSourceConfig.jsonData, azurePrometheusResourceId: event.currentTarget.value },
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
