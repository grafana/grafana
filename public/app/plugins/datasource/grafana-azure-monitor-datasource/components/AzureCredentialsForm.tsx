import React, { ChangeEvent, FunctionComponent, useEffect, useReducer, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineFormLabel, LegacyForms, Button, Select, InlineField } from '@grafana/ui';

import { isCredentialsComplete } from '../credentials';
import { selectors } from '../e2e/selectors';
import { AzureAuthType, AzureCredentials } from '../types';

const { Input } = LegacyForms;

export interface Props {
  managedIdentityEnabled: boolean;
  credentials: AzureCredentials;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange?: (updatedCredentials: AzureCredentials) => void;
  getSubscriptions?: () => Promise<SelectableValue[]>;
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

export const AzureCredentialsForm: FunctionComponent<Props> = (props: Props) => {
  const { credentials, azureCloudOptions, onCredentialsChange, getSubscriptions, disabled } = props;
  const hasRequiredFields = isCredentialsComplete(credentials);

  const [subscriptions, setSubscriptions] = useState<Array<SelectableValue<string>>>([]);
  const [loadSubscriptionsClicked, onLoadSubscriptions] = useReducer((val) => val + 1, 0);
  useEffect(() => {
    if (!getSubscriptions || !hasRequiredFields) {
      updateSubscriptions([]);
      return;
    }
    let canceled = false;
    getSubscriptions().then((result) => {
      if (!canceled) {
        updateSubscriptions(result, loadSubscriptionsClicked);
      }
    });
    return () => {
      canceled = true;
    };
    // This effect is intended to be called only once initially and on Load Subscriptions click
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSubscriptionsClicked]);

  const updateSubscriptions = (received: Array<SelectableValue<string>>, autoSelect = false) => {
    setSubscriptions(received);
    if (getSubscriptions) {
      if (autoSelect && !credentials.defaultSubscriptionId && received.length > 0) {
        // Selecting the default subscription if subscriptions received but no default subscription selected
        onSubscriptionChange(received[0]);
      } else if (credentials.defaultSubscriptionId) {
        const found = received.find((opt) => opt.value === credentials.defaultSubscriptionId);
        if (!found) {
          // Unselecting the default subscription if it isn't found among the received subscriptions
          onSubscriptionChange(undefined);
        }
      }
    }
  };

  const onAuthTypeChange = (selected: SelectableValue<AzureAuthType>) => {
    if (onCredentialsChange) {
      setSubscriptions([]);
      const updated: AzureCredentials = {
        ...credentials,
        authType: selected.value || 'msi',
        defaultSubscriptionId: undefined,
      };
      onCredentialsChange(updated);
    }
  };

  const onAzureCloudChange = (selected: SelectableValue<string>) => {
    if (onCredentialsChange && credentials.authType === 'clientsecret') {
      setSubscriptions([]);
      const updated: AzureCredentials = {
        ...credentials,
        azureCloud: selected.value,
        defaultSubscriptionId: undefined,
      };
      onCredentialsChange(updated);
    }
  };

  const onTenantIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onCredentialsChange && credentials.authType === 'clientsecret') {
      setSubscriptions([]);
      const updated: AzureCredentials = {
        ...credentials,
        tenantId: event.target.value,
        defaultSubscriptionId: undefined,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onCredentialsChange && credentials.authType === 'clientsecret') {
      setSubscriptions([]);
      const updated: AzureCredentials = {
        ...credentials,
        clientId: event.target.value,
        defaultSubscriptionId: undefined,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onCredentialsChange && credentials.authType === 'clientsecret') {
      setSubscriptions([]);
      const updated: AzureCredentials = {
        ...credentials,
        clientSecret: event.target.value,
        defaultSubscriptionId: undefined,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientSecretReset = () => {
    if (onCredentialsChange && credentials.authType === 'clientsecret') {
      setSubscriptions([]);
      const updated: AzureCredentials = {
        ...credentials,
        clientSecret: '',
        defaultSubscriptionId: undefined,
      };
      onCredentialsChange(updated);
    }
  };

  const onSubscriptionChange = (selected: SelectableValue<string> | undefined) => {
    if (onCredentialsChange) {
      const updated: AzureCredentials = {
        ...credentials,
        defaultSubscriptionId: selected?.value,
      };
      onCredentialsChange(updated);
    }
  };

  return (
    <div className="gf-form-group">
      {props.managedIdentityEnabled && (
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
              <div className="gf-form-inline">
                <div className="gf-form">
                  <InlineFormLabel className="width-12">Client Secret</InlineFormLabel>
                  <Input data-testid="client-secret" className="width-25" placeholder="configured" disabled={true} />
                </div>
                <div className="gf-form">
                  <div className="max-width-30 gf-form-inline">
                    <Button variant="secondary" type="button" onClick={onClientSecretReset} disabled={disabled}>
                      reset
                    </Button>
                  </div>
                </div>
              </div>
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
                  disabled={disabled}
                />
              </InlineField>
            ))}
        </>
      )}
      {getSubscriptions && (
        <>
          <div className="gf-form-inline">
            <div className="gf-form" data-testid={selectors.components.configEditor.defaultSubscription.input}>
              <InlineFormLabel className="width-12">Default Subscription</InlineFormLabel>
              <div className="width-30">
                <Select
                  aria-label="Default Subscription"
                  value={
                    credentials.defaultSubscriptionId
                      ? subscriptions.find((opt) => opt.value === credentials.defaultSubscriptionId)
                      : undefined
                  }
                  options={subscriptions}
                  onChange={onSubscriptionChange}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
          {!disabled && (
            <div className="gf-form-inline">
              <div className="gf-form">
                <div className="max-width-30 gf-form-inline">
                  <Button
                    variant="secondary"
                    aria-label="Load Subscriptions"
                    size="sm"
                    type="button"
                    onClick={onLoadSubscriptions}
                    disabled={!hasRequiredFields}
                    data-testid={selectors.components.configEditor.loadSubscriptions.button}
                  >
                    Load Subscriptions
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {props.children}
    </div>
  );
};

export default AzureCredentialsForm;
