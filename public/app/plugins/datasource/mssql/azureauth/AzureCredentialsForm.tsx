import { ChangeEvent } from 'react';

import { AzureCredentials, AzureAuthType } from '@grafana/azure-sdk';
import { SelectableValue } from '@grafana/data';
import { Button, Field, Select, Input } from '@grafana/ui/src/components';

export interface Props {
  managedIdentityEnabled: boolean;
  azureEntraPasswordCredentialsEnabled: boolean;
  credentials: AzureCredentials;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange: (updatedCredentials: AzureCredentials) => void;
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
      const updated: AzureCredentials = {
        ...credentials,
        authType: selected.value || 'msi',
      };
      onCredentialsChange(updated);
    }
  };

  const onAzureCloudChange = (selected: SelectableValue<string>) => {
    if (credentials.authType === 'clientsecret') {
      const updated: AzureCredentials = {
        ...credentials,
        azureCloud: selected.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onTenantIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (credentials.authType === 'clientsecret') {
      const updated: AzureCredentials = {
        ...credentials,
        tenantId: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (credentials.authType === 'clientsecret' || credentials.authType === 'ad-password') {
      const updated: AzureCredentials = {
        ...credentials,
        clientId: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (credentials.authType === 'clientsecret') {
      const updated: AzureCredentials = {
        ...credentials,
        clientSecret: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientSecretReset = () => {
    if (credentials.authType === 'clientsecret') {
      const updated: AzureCredentials = {
        ...credentials,
        clientSecret: '',
      };
      onCredentialsChange(updated);
    }
  };

  const onUserIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (credentials.authType === 'ad-password') {
      const updated: AzureCredentials = {
        ...credentials,
        userId: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (credentials.authType === 'ad-password') {
      const updated: AzureCredentials = {
        ...credentials,
        password: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onPasswordReset = () => {
    if (credentials.authType === 'ad-password') {
      const updated: AzureCredentials = {
        ...credentials,
        password: '',
      };
      onCredentialsChange(updated);
    }
  };

  const authTypeOptions: Array<SelectableValue<AzureAuthType>> = [
    {
      value: 'clientsecret',
      label: 'App Registration',
    },
  ];
  if (managedIdentityEnabled) {
    authTypeOptions.push({
      value: 'msi',
      label: 'Managed Identity',
    });
  }
  if (azureEntraPasswordCredentialsEnabled) {
    authTypeOptions.push({
      value: 'ad-password',
      label: 'Azure Entra Password',
    });
  }

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
      {credentials.authType === 'clientsecret' && (
        <>
          {azureCloudOptions && (
            <Field label="Azure Cloud" htmlFor="azure-cloud-type" disabled={disabled}>
              <Select
                value={azureCloudOptions.find((opt) => opt.value === credentials.azureCloud)}
                options={azureCloudOptions}
                onChange={onAzureCloudChange}
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
              onChange={onTenantIdChange}
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
              onChange={onClientIdChange}
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
                  <Button variant="secondary" type="button" onClick={onClientSecretReset} disabled={disabled}>
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
                  onChange={onClientSecretChange}
                  id="client-secret"
                  disabled={disabled}
                />
              </Field>
            ))}
        </>
      )}
      {credentials.authType === 'ad-password' && azureEntraPasswordCredentialsEnabled && (
        <>
          <Field label="User Id" required htmlFor="user-id" invalid={!credentials.userId} error={'User ID is required'}>
            <Input
              width={45}
              value={credentials.userId || ''}
              onChange={onUserIdChange}
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
              onChange={onClientIdChange}
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
                  <Button variant="secondary" type="button" onClick={onPasswordReset} disabled={disabled}>
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
                  onChange={onPasswordChange}
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
