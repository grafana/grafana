import React, { ChangeEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineFormLabel, Button } from '@grafana/ui/src/components';
import { Input } from '@grafana/ui/src/components/Forms/Legacy/Input/Input';
import { Select } from '@grafana/ui/src/components/Forms/Legacy/Select/Select';

import { AzureCredentialsType, AzureAuthType } from '../types';

export interface Props {
  managedIdentityEnabled: boolean;
  credentials: AzureCredentialsType;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange: (updatedCredentials: AzureCredentialsType) => void;
  disabled?: boolean;
}

const authTypeOptions: Array<SelectableValue<AzureAuthType>> = [
  {
    value: AzureAuthType.MSI,
    label: 'Managed Identity',
  },
  {
    value: AzureAuthType.CLIENT_SECRET,
    label: 'App Registration',
  },
];

export const AzureCredentialsForm = (props: Props) => {
  const { managedIdentityEnabled, credentials, azureCloudOptions, onCredentialsChange, disabled } = props;

  const onAuthTypeChange = (selected: SelectableValue<AzureAuthType>) => {
    if (onCredentialsChange) {
      const updated: AzureCredentialsType = {
        ...credentials,
        authType: selected.value || AzureAuthType.MSI,
      };
      onCredentialsChange(updated);
    }
  };

  const onInputChange = ({ property, value }: { property: keyof AzureCredentialsType; value: string }) => {
    if (onCredentialsChange && credentials.authType === 'clientsecret') {
      const updated: AzureCredentialsType = {
        ...credentials,
        [property]: value,
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
                  onChange={(selected: SelectableValue<AzureAuthType>) => {
                    const value = selected.value || '';
                    onInputChange({ property: 'azureCloud', value });
                  }}
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
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const value = event.target.value;
                    onInputChange({ property: 'tenantId', value });
                  }}
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
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const value = event.target.value;
                    onInputChange({ property: 'clientId', value });
                  }}
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
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => {
                        onInputChange({ property: 'clientSecret', value: '' });
                      }}
                    >
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
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      const value = event.target.value;
                      onInputChange({ property: 'clientSecret', value });
                    }}
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
