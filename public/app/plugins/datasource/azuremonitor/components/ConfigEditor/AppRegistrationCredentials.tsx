import React, { ChangeEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { Field, Select, Input, Button, Alert, VerticalGroup } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import { AadCurrentUserCredentials, AzureClientSecretCredentials, AzureCredentials } from '../../types';

export interface AppRegistrationCredentialsProps {
  credentials: AadCurrentUserCredentials | AzureClientSecretCredentials;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange: (updatedCredentials: AzureCredentials) => void;
  disabled?: boolean;
}

export const AppRegistrationCredentials = (props: AppRegistrationCredentialsProps) => {
  const { azureCloudOptions, disabled, credentials, onCredentialsChange } = props;

  const onAzureCloudChange = (selected: SelectableValue<string>) => {
    if (credentials.authType === 'clientsecret' || credentials.authType === 'currentuser') {
      const updated: AzureCredentials = {
        ...credentials,
        azureCloud: selected.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onTenantIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (credentials.authType === 'clientsecret' || credentials.authType === 'currentuser') {
      const updated: AzureCredentials = {
        ...credentials,
        tenantId: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (credentials.authType === 'clientsecret' || credentials.authType === 'currentuser') {
      const updated: AzureCredentials = {
        ...credentials,
        clientId: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (credentials.authType === 'clientsecret' || credentials.authType === 'currentuser') {
      const updated: AzureCredentials = {
        ...credentials,
        clientSecret: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientSecretReset = () => {
    if (credentials.authType === 'clientsecret' || credentials.authType === 'currentuser') {
      const updated: AzureCredentials = {
        ...credentials,
        clientSecret: '',
      };
      onCredentialsChange(updated);
    }
  };

  return (
    <>
      {credentials.authType === 'currentuser' && (
        <Alert severity="info" title="Service Principal Credentials">
          <VerticalGroup>
            <div>
              User-based authentication does not support Grafana features that make requests to the data source without
              a users details available to the request. An example of this is alerting. If you wish to ensure that
              features that do not have a user in the context of the request still function as expected then please
              provide App Registration credentials below.
            </div>
            <div>
              <b>
                Note: Features like alerting will be restricted to the access level of the app registration rather than
                the user. This may present confusion for users and should be clarified.
              </b>
            </div>
          </VerticalGroup>
        </Alert>
      )}
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
        required={credentials.authType === 'clientsecret'}
        data-testid={selectors.components.configEditor.tenantID.input}
        htmlFor="tenant-id"
        invalid={credentials.authType === 'clientsecret' && !credentials.tenantId}
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
        required={credentials.authType === 'clientsecret'}
        data-testid={selectors.components.configEditor.clientID.input}
        htmlFor="client-id"
        invalid={credentials.authType === 'clientsecret' && !credentials.clientId}
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
          <Field label="Client Secret" htmlFor="client-secret" required={credentials.authType === 'clientsecret'}>
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
            required={credentials.authType === 'clientsecret'}
            htmlFor="client-secret"
            invalid={credentials.authType === 'clientsecret' && !credentials.clientSecret}
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
  );
};
