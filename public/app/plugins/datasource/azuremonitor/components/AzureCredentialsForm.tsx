import React, { ChangeEvent, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { ConfigSection } from '@grafana/experimental';
import { Button, Select, Field, Input } from '@grafana/ui';

import { selectors } from '../e2e/selectors';
import { AzureAuthType, AzureCredentials } from '../types';

export interface Props {
  managedIdentityEnabled: boolean;
  workloadIdentityEnabled: boolean;
  credentials: AzureCredentials;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange: (updatedCredentials: AzureCredentials) => void;
  disabled?: boolean;
  children?: JSX.Element;
}

export const AzureCredentialsForm = (props: Props) => {
  const {
    credentials,
    azureCloudOptions,
    onCredentialsChange,
    disabled,
    managedIdentityEnabled,
    workloadIdentityEnabled,
  } = props;

  const authTypeOptions = useMemo(() => {
    let opts: Array<SelectableValue<AzureAuthType>> = [
      {
        value: 'clientsecret',
        label: 'App Registration',
      },
    ];

    if (managedIdentityEnabled) {
      opts.push({
        value: 'msi',
        label: 'Managed Identity',
      });
    }

    if (workloadIdentityEnabled) {
      opts.push({
        value: 'workloadidentity',
        label: 'Workload Identity',
      });
    }

    return opts;
  }, [managedIdentityEnabled, workloadIdentityEnabled]);

  const onAuthTypeChange = (selected: SelectableValue<AzureAuthType>) => {
    const defaultAuthType = managedIdentityEnabled
      ? 'msi'
      : workloadIdentityEnabled
        ? 'workloadidentity'
        : 'clientsecret';
    const updated: AzureCredentials = {
      ...credentials,
      authType: selected.value || defaultAuthType,
    };
    onCredentialsChange(updated);
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
    if (credentials.authType === 'clientsecret') {
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

  return (
    <ConfigSection title="Authentication">
      {authTypeOptions.length > 1 && (
        <Field
          label="Authentication"
          description="Choose the type of authentication to Azure services"
          data-testid={selectors.components.configEditor.authType.select}
          htmlFor="authentication-type"
        >
          <Select
            className="width-15"
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
            <Field
              label="Azure Cloud"
              data-testid={selectors.components.configEditor.azureCloud.input}
              htmlFor="azure-cloud-type"
              disabled={disabled}
            >
              <Select
                inputId="azure-cloud-type"
                aria-label="Azure Cloud"
                className="width-15"
                value={azureCloudOptions.find((opt) => opt.value === credentials.azureCloud)}
                options={azureCloudOptions}
                onChange={onAzureCloudChange}
              />
            </Field>
          )}
          <Field
            label="Directory (tenant) ID"
            required
            data-testid={selectors.components.configEditor.tenantID.input}
            htmlFor="tenant-id"
            invalid={!credentials.tenantId}
            error={'Tenant ID is required'}
          >
            <Input
              aria-label="Tenant ID"
              className="width-30"
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              value={credentials.tenantId || ''}
              onChange={onTenantIdChange}
              disabled={disabled}
            />
          </Field>
          <Field
            label="Application (client) ID"
            required
            data-testid={selectors.components.configEditor.clientID.input}
            htmlFor="client-id"
            invalid={!credentials.clientId}
            error={'Client ID is required'}
          >
            <Input
              className="width-30"
              aria-label="Client ID"
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              value={credentials.clientId || ''}
              onChange={onClientIdChange}
              disabled={disabled}
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
                  />
                  <Button variant="secondary" type="button" onClick={onClientSecretReset} disabled={disabled}>
                    Reset
                  </Button>
                </div>
              </Field>
            ) : (
              <Field
                label="Client Secret"
                data-testid={selectors.components.configEditor.clientSecret.input}
                required
                htmlFor="client-secret"
                invalid={!credentials.clientSecret}
                error={'Client secret is required'}
              >
                <Input
                  className="width-30"
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
      {props.children}
    </ConfigSection>
  );
};

export default AzureCredentialsForm;
