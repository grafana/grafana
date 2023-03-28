import React, { ChangeEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { LegacyForms, Button, Select, InlineField } from '@grafana/ui';

import { selectors } from '../e2e/selectors';
import { AzureAuthType, AzureCredentials } from '../types';

const { Input } = LegacyForms;

export interface Props {
  managedIdentityEnabled: boolean;
  credentials: AzureCredentials;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange?: (updatedCredentials: AzureCredentials) => void;
  disabled?: boolean;
  children?: JSX.Element;
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

const LABEL_WIDTH = 18;

export const AzureCredentialsForm = (props: Props) => {
  const { credentials, azureCloudOptions, onCredentialsChange, disabled, managedIdentityEnabled } = props;

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
    <div className="gf-form-group">
      {managedIdentityEnabled && (
        <InlineField
          label="Authentication"
          labelWidth={LABEL_WIDTH}
          tooltip="Choose the type of authentication to Azure services"
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
        </InlineField>
      )}
      {credentials.authType === 'clientsecret' && (
        <>
          {azureCloudOptions && (
            <InlineField
              label="Azure Cloud"
              labelWidth={LABEL_WIDTH}
              tooltip="Choose an Azure Cloud"
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
            </InlineField>
          )}
          <InlineField
            label="Directory (tenant) ID"
            labelWidth={LABEL_WIDTH}
            data-testid={selectors.components.configEditor.tenantID.input}
            htmlFor="tenant-id"
          >
            <div className="width-15">
              <Input
                aria-label="Tenant ID"
                className="width-30"
                placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                value={credentials.tenantId || ''}
                onChange={onTenantIdChange}
                disabled={disabled}
              />
            </div>
          </InlineField>
          <InlineField
            label="Application (client) ID"
            labelWidth={LABEL_WIDTH}
            data-testid={selectors.components.configEditor.clientID.input}
            htmlFor="tenant-id"
          >
            <div className="width-15">
              <Input
                className="width-30"
                aria-label="Client ID"
                placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                value={credentials.clientId || ''}
                onChange={onClientIdChange}
                disabled={disabled}
              />
            </div>
          </InlineField>
          {!disabled &&
            (typeof credentials.clientSecret === 'symbol' ? (
              <InlineField label="Client Secret" labelWidth={LABEL_WIDTH} htmlFor="client-secret">
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
              </InlineField>
            ) : (
              <InlineField
                label="Client Secret"
                labelWidth={LABEL_WIDTH}
                data-testid={selectors.components.configEditor.clientSecret.input}
                htmlFor="client-secret"
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
              </InlineField>
            ))}
        </>
      )}
      {props.children}
    </div>
  );
};

export default AzureCredentialsForm;
