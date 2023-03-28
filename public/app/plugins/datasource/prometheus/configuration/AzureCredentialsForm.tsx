import React, { ChangeEvent, FunctionComponent, useEffect, useReducer, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineFormLabel, Button } from '@grafana/ui/src/components';
import { Input } from '@grafana/ui/src/components/Forms/Legacy/Input/Input';
import { Select } from '@grafana/ui/src/components/Forms/Legacy/Select/Select';

import { AzureAuthType, AzureCredentials, isCredentialsComplete } from './AzureCredentials';

export interface Props {
  managedIdentityEnabled: boolean;
  credentials: AzureCredentials;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange: (updatedCredentials: AzureCredentials) => void;
  getSubscriptions?: () => Promise<SelectableValue[]>;
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
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel className="width-12" tooltip="Choose the type of authentication to Azure services">
              Authentication
            </InlineFormLabel>
            <Select
              className="width-15"
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
                  className="width-15"
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
      {getSubscriptions && (
        <>
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineFormLabel className="width-12">Default Subscription</InlineFormLabel>
              <div className="width-25">
                <Select
                  value={
                    credentials.defaultSubscriptionId
                      ? subscriptions.find((opt) => opt.value === credentials.defaultSubscriptionId)
                      : undefined
                  }
                  options={subscriptions}
                  onChange={onSubscriptionChange}
                  isDisabled={disabled}
                />
              </div>
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <div className="max-width-30 gf-form-inline">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={onLoadSubscriptions}
                  disabled={!hasRequiredFields}
                >
                  Load Subscriptions
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AzureCredentialsForm;
