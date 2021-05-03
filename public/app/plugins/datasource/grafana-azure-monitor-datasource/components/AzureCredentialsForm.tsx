import React, { ChangeEvent, FunctionComponent, useEffect, useReducer, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { InlineFormLabel, LegacyForms, Button } from '@grafana/ui';
import { AzureCredentials } from '../types';
import { isCredentialsComplete } from '../credentials';
const { Select, Input } = LegacyForms;

export interface Props {
  credentials: AzureCredentials;
  defaultSubscription?: string;
  azureCloudOptions?: SelectableValue[];
  onCredentialsChange: (updatedCredentials: AzureCredentials) => void;
  onDefaultSubscriptionChange?: (subscriptionId: string | undefined) => void;
  getSubscriptions?: () => Promise<SelectableValue[]>;
}

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
    if (!getSubscriptions || !hasRequiredFields || loadSubscriptions === 0) {
      return;
    }
    let canceled = false;
    getSubscriptions().then((result) => {
      if (!canceled) {
        setSubscriptions(result);
        if (onDefaultSubscriptionChange && !defaultSubscription && result.length > 0) {
          onDefaultSubscriptionChange(result[0].value);
        }
      }
    });
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSubscriptions]);

  const onAzureCloudChange = (selected: SelectableValue<string>) => {
    if (onCredentialsChange) {
      const updated: AzureCredentials = {
        ...credentials,
        azureCloud: selected.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onTenantIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onCredentialsChange) {
      const updated: AzureCredentials = {
        ...credentials,
        tenantId: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onCredentialsChange) {
      const updated: AzureCredentials = {
        ...credentials,
        clientId: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onCredentialsChange) {
      const updated: AzureCredentials = {
        ...credentials,
        clientSecret: event.target.value,
      };
      onCredentialsChange(updated);
    }
  };

  const onClientSecretReset = () => {
    if (onCredentialsChange) {
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
    <>
      <div className="gf-form-group">
        {azureCloudOptions && (
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineFormLabel className="width-12" tooltip="Choose an Azure Cloud.">
                Azure Cloud
              </InlineFormLabel>
              <Select
                className="width-15"
                value={azureCloudOptions.find((opt) => opt.value === credentials.azureCloud)}
                options={azureCloudOptions}
                defaultValue={credentials.azureCloud}
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
        {typeof credentials.clientSecret === 'object' ? (
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
        {getSubscriptions && onDefaultSubscriptionChange && (
          <>
            <div className="gf-form-inline">
              <div className="gf-form">
                <InlineFormLabel className="width-12">Default Subscription</InlineFormLabel>
                <div className="width-25">
                  <Select
                    value={subscriptions.find((opt) => opt.value === defaultSubscription)}
                    options={subscriptions}
                    defaultValue={defaultSubscription}
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
    </>
  );
};

export default AzureCredentialsForm;
