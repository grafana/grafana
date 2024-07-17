import { ChangeEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { Button, Field, Select, Input } from '@grafana/ui/src/components';

import { AzureCredentialsType, AzureAuthType } from '../types';

export interface Props {
  managedIdentityEnabled: boolean;
  azureEntraPasswordCredentialsEnabled: boolean;
  credentials: AzureCredentialsType;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange: (updatedCredentials: AzureCredentialsType) => void;
  disabled?: boolean;
}

export const AzureCredentialsForm = (props: Props) => {
  const {
    managedIdentityEnabled,
    azureEntraPasswordCredentialsEnabled,
    credentials,
    azureCloudOptions,
    onCredentialsChange,
    disabled,
  } = props;

  const onAuthTypeChange = (selected: SelectableValue<AzureAuthType>) => {
    if (onCredentialsChange) {
      const updated: AzureCredentialsType = {
        ...credentials,
        authType: selected.value || AzureAuthType.MSI,
      };
      onCredentialsChange(updated);
    }
  };

  const authTypeOptions: Array<SelectableValue<AzureAuthType>> = [
    {
      value: AzureAuthType.CLIENT_SECRET,
      label: 'App Registration',
    },
  ];
  if (managedIdentityEnabled) {
    authTypeOptions.push({
      value: AzureAuthType.MSI,
      label: 'Managed Identity',
    });
  }
  if (azureEntraPasswordCredentialsEnabled) {
    authTypeOptions.push({
      value: AzureAuthType.AD_PASSWORD,
      label: 'Azure Entra Password',
    });
  }

  const onInputChange = ({ property, value }: { property: keyof AzureCredentialsType; value: string }) => {
    if (onCredentialsChange) {
      const updated: AzureCredentialsType = {
        ...credentials,
        [property]: value,
      };
      onCredentialsChange(updated);
    }
  };

  return (
    <div>
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
      {credentials.authType === AzureAuthType.CLIENT_SECRET && (
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
      {credentials.authType === AzureAuthType.AD_PASSWORD && azureEntraPasswordCredentialsEnabled && (
        <>
          <Field label="User Id" required htmlFor="user-id" invalid={!credentials.userId} error={'User ID is required'}>
            <Input
              width={45}
              value={credentials.userId || ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const value = event.target.value;
                onInputChange({ property: 'userId', value });
              }}
              disabled={disabled}
              aria-label="User ID"
            />
          </Field>
          <Field
            label="Application Client ID"
            required
            htmlFor="application-client-id"
            invalid={!credentials.clientId}
            error={'Application Client ID is required'}
          >
            <Input
              width={45}
              value={credentials.clientId || ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const value = event.target.value;
                onInputChange({ property: 'clientId', value });
              }}
              disabled={disabled}
              aria-label="Application Client ID"
            />
          </Field>
          {!disabled &&
            (typeof credentials.password === 'symbol' ? (
              <Field label="Password" htmlFor="password" required>
                <div className="width-30" style={{ display: 'flex', gap: '4px' }}>
                  <Input
                    aria-label="Password"
                    placeholder="configured"
                    disabled={true}
                    data-testid={'password'}
                    width={45}
                  />
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      onInputChange({ property: 'password', value: '' });
                    }}
                    disabled={disabled}
                  >
                    Reset
                  </Button>
                </div>
              </Field>
            ) : (
              <Field
                label="Password"
                required
                htmlFor="password"
                invalid={!credentials.password}
                error={'Password is required'}
              >
                <Input
                  width={45}
                  aria-label="Password"
                  value={credentials.password || ''}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const value = event.target.value;
                    onInputChange({ property: 'password', value });
                  }}
                  id="password"
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
