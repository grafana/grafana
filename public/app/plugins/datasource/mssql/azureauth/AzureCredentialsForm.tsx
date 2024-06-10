import React, { ChangeEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { Button, Field, Select, Input } from '@grafana/ui/src/components';

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
        <Field
          label="Authentication"
          description="Choose the type of authentication to Azure services"
          htmlFor="authentication-type"
        >
          <Select
            width={20}
            value={authTypeOptions.find((opt) => opt.value === credentials.authType)}
            options={authTypeOptions}
            onChange={onAuthTypeChange}
            disabled={disabled}
          />
        </Field>
      )}
      {credentials.authType === 'clientsecret' && (
        <>
          {azureCloudOptions && (
            <Field label="Azure Cloud" htmlFor="azure-cloud-type" disabled={disabled}>
              <Select
                value={azureCloudOptions.find((opt) => opt.value === credentials.azureCloud)}
                options={azureCloudOptions}
                onChange={(selected: SelectableValue<AzureAuthType>) => {
                  const value = selected.value || '';
                  onInputChange({ property: 'azureCloud', value });
                }}
                isDisabled={disabled}
                inputId="azure-cloud-type"
                aria-label="Azure Cloud"
                width={20}
              />
            </Field>
          )}
          <Field
            label="Directory (tenant) ID"
            required
            htmlFor="tenant-id"
            invalid={!credentials.tenantId}
            error={'Tenant ID is required'}
          >
            <Input
              width={45}
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              value={credentials.tenantId || ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const value = event.target.value;
                onInputChange({ property: 'tenantId', value });
              }}
              disabled={disabled}
              aria-label="Tenant ID"
            />
          </Field>
          <Field
            label="Application (client) ID"
            required
            htmlFor="client-id"
            invalid={!credentials.clientId}
            error={'Client ID is required'}
          >
            <Input
              width={45}
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              value={credentials.clientId || ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const value = event.target.value;
                onInputChange({ property: 'clientId', value });
              }}
              disabled={disabled}
              aria-label="Client ID"
            />
          </Field>
          {!disabled &&
            (typeof credentials.clientSecret === 'symbol' ? (
              <Field label="Client Secret" htmlFor="client-secret" required>
                <div className="width-30" style={{ display: 'flex', gap: '4px' }}>
                  <Input
                    aria-label="Client Secret"
                    placeholder="configured"
                    disabled={true}
                    data-testid={'client-secret'}
                    width={45}
                  />
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      onInputChange({ property: 'clientSecret', value: '' });
                    }}
                    disabled={disabled}
                  >
                    Reset
                  </Button>
                </div>
              </Field>
            ) : (
              <Field
                label="Client Secret"
                required
                htmlFor="client-secret"
                invalid={!credentials.clientSecret}
                error={'Client secret is required'}
              >
                <Input
                  width={45}
                  aria-label="Client Secret"
                  placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                  value={credentials.clientSecret || ''}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const value = event.target.value;
                    onInputChange({ property: 'clientSecret', value });
                  }}
                  id="client-secret"
                  disabled={disabled}
                />
              </Field>
            ))}
        </>
      )}
    </div>
  );
};

export default AzureCredentialsForm;
