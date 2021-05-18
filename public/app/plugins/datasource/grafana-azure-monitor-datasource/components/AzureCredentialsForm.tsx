import React, { ChangeEvent, FunctionComponent, useEffect, useReducer, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { InlineFormLabel, LegacyForms, Button } from '@grafana/ui';
import { AzureAuthType, AzureCredentials } from '../types';
import { isCredentialsComplete } from '../credentials';
const { Select, Input } = LegacyForms;

export interface Props {
  managedIdentityEnabled: boolean;
  credentials: AzureCredentials;
  defaultSubscription?: string;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange: (updatedCredentials: AzureCredentials) => void;
  onDefaultSubscriptionChange?: (subscriptionId: string | undefined) => void;
  getSubscriptions?: () => Promise<SelectableValue[]>;
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
  const {
    credentials,
    defaultSubscription,
    azureCloudOptions,
    onCredentialsChange,
    onDefaultSubscriptionChange,
    getSubscriptions,
  } = props;
  const hasRequiredFields = isCredentialsComplete(credentials);

  const [subscriptions, setSubscriptions] = useState<Array<SelectableValue<string>>>([]);
  const [loadSubscriptions, onLoadSubscriptions] = useReducer((val) => val + 1, 0);
  useEffect(() => {
    if (!getSubscriptions || !hasRequiredFields) {
      updateSubscriptions([]);
      return;
    }
    let canceled = false;
    getSubscriptions().then((result) => {
      if (!canceled) {
        updateSubscriptions(result);
      }
    });
    return () => {
      canceled = true;
    };
    // This effect is intended to be called only once initially and on Load Subscriptions click
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSubscriptions]);

  const updateSubscriptions = (received: Array<SelectableValue<string>>) => {
    setSubscriptions(received);
    if (onDefaultSubscriptionChange) {
      if (!defaultSubscription && received.length > 0) {
        // Setting the default subscription if subscriptions received but no default subscription selected
        onDefaultSubscriptionChange(received[0].value);
      } else if (defaultSubscription) {
        const found = received.find((opt) => opt.value === defaultSubscription);
        if (!found) {
          // Unsetting the default found if it isn't found among the received subscriptions
          onDefaultSubscriptionChange(undefined);
        }
      }
    }
  };

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

  const onSubscriptionChange = (selected: SelectableValue<string>) => {
    if (onDefaultSubscriptionChange) {
      onDefaultSubscriptionChange(selected?.value);
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
                />
              </div>
            </div>
          </div>
          {typeof credentials.clientSecret === 'symbol' ? (
            <div className="gf-form-inline">
              <div className="gf-form">
                <InlineFormLabel className="width-12">Client Secret</InlineFormLabel>
                <Input className="width-25" placeholder="configured" disabled={true} />
              </div>
              <div className="gf-form">
                <div className="max-width-30 gf-form-inline">
                  <Button variant="secondary" type="button" onClick={onClientSecretReset}>
                    reset
                  </Button>
                </div>
              </div>
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
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {getSubscriptions && onDefaultSubscriptionChange && (
        <>
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineFormLabel className="width-12">Default Subscription</InlineFormLabel>
              <div className="width-25">
                <Select
                  value={subscriptions.find((opt) => opt.value === defaultSubscription)}
                  options={subscriptions}
                  onChange={onSubscriptionChange}
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
