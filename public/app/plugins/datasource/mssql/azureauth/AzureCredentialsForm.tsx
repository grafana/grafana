import React, { ChangeEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineFormLabel, Button } from '@grafana/ui/src/components';
import { Input } from '@grafana/ui/src/components/Forms/Legacy/Input/Input';
import { Select } from '@grafana/ui/src/components/Forms/Legacy/Select/Select';

import { AzureCredentials, AzureAuthType } from './AzureCredentials';

export interface Props {
  managedIdentityEnabled: boolean;
  credentials: AzureCredentials;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange: (updatedCredentials: AzureCredentials) => void;
  disabled?: boolean;
}

const authTypeOptions: Array<SelectableValue<AzureAuthType>> = [
  {
    value: 'msi',
    label: 'Managed Identity',
  },
  {
    value: 'clientsecret',
    label: 'App Registration',
  },
];

export const AzureCredentialsForm = (props: Props) => {
  const { managedIdentityEnabled, credentials, azureCloudOptions, onCredentialsChange, disabled } = props;

  // JEV: clean these funcs up
  const onAuthTypeChange = (selected: SelectableValue<AzureAuthType>) => {
    if (onCredentialsChange) {
      const updated: AzureCredentials = {
        ...credentials,
        authType: selected.value || 'msi',
      };
      onCredentialsChange(updated);
    }
  };

  const onAzureCloudChange = (selected: SelectableValue<string>) => {
    if (onCredentialsChange && credentials.authType === 'clientsecret') {
      const updated: AzureCredentials = {
        ...credentials,
        azureCloud: selected.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onTenantIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onCredentialsChange && credentials.authType === 'clientsecret') {
      const updated: AzureCredentials = {
        ...credentials,
        tenantId: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onCredentialsChange && credentials.authType === 'clientsecret') {
      const updated: AzureCredentials = {
        ...credentials,
        clientId: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onCredentialsChange && credentials.authType === 'clientsecret') {
      const updated: AzureCredentials = {
        ...credentials,
        clientSecret: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientSecretReset = () => {
    if (onCredentialsChange && credentials.authType === 'clientsecret') {
      const updated: AzureCredentials = {
        ...credentials,
        clientSecret: '',
      };
      onCredentialsChange(updated);
    }
  };

  return (
    <div>
      {managedIdentityEnabled && (
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel tooltip="Choose the type of authentication to Azure services">
              Authentication
            </InlineFormLabel>
            <Select
              value={authTypeOptions.find((opt) => opt.value === credentials.authType)}
              options={authTypeOptions}
              onChange={onAuthTypeChange}
              isDisabled={disabled}
            />
          </div>
        </div>
      )}
      {credentials.authType === 'clientsecret' && (
        <>
          {azureCloudOptions && (
            <div className="gf-form-inline">
              <div className="gf-form">
                <InlineFormLabel className="width-12" tooltip="Choose an Azure Cloud">
                  Azure Cloud
                </InlineFormLabel>
                <Select
                  value={azureCloudOptions.find((opt) => opt.value === credentials.azureCloud)}
                  options={azureCloudOptions}
                  onChange={onAzureCloudChange}
                  isDisabled={disabled}
                />
              </div>
            </div>
          )}
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineFormLabel className="width-12">Directory (tenant) ID</InlineFormLabel>
              <div className="width-15">
                <Input
                  className="width-30"
                  placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                  value={credentials.tenantId || ''}
                  onChange={onTenantIdChange}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineFormLabel className="width-12">Application (client) ID</InlineFormLabel>
              <div className="width-15">
                <Input
                  className="width-30"
                  placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                  value={credentials.clientId || ''}
                  onChange={onClientIdChange}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
          {typeof credentials.clientSecret === 'symbol' ? (
            <div className="gf-form-inline">
              <div className="gf-form">
                <InlineFormLabel htmlFor="azure-client-secret" className="width-12">
                  Client Secret
                </InlineFormLabel>
                <Input id="azure-client-secret" className="width-25" placeholder="configured" disabled />
              </div>
              {!disabled && (
                <div className="gf-form">
                  <div className="max-width-30 gf-form-inline">
                    <Button variant="secondary" type="button" onClick={onClientSecretReset}>
                      reset
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="gf-form-inline">
              <div className="gf-form">
                <InlineFormLabel className="width-12">Client Secret</InlineFormLabel>
                <div className="width-15">
                  <Input
                    className="width-30"
                    placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                    value={credentials.clientSecret || ''}
                    onChange={onClientSecretChange}
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AzureCredentialsForm;
