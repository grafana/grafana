import React, { useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';

import { getCredentials, updateCredentials } from '../credentials';
import { AzureDataSourceSettings, AzureCredentials } from '../types';

import { AzureCredentialsForm } from './AzureCredentialsForm';
import { DefaultSubscription } from './DefaultSubscription';

const azureClouds = [
  { value: 'azuremonitor', label: 'Azure' },
  { value: 'govazuremonitor', label: 'Azure US Government' },
  { value: 'chinaazuremonitor', label: 'Azure China' },
] as SelectableValue[];

export interface Props {
  options: AzureDataSourceSettings;
  updateOptions: (optionsFunc: (options: AzureDataSourceSettings) => AzureDataSourceSettings) => void;
  getSubscriptions: () => Promise<Array<SelectableValue<string>>>;
}

export const MonitorConfig = (props: Props) => {
  const { updateOptions, getSubscriptions, options } = props;
  const [subscriptions, setSubscriptions] = useState<Array<SelectableValue<string>>>([]);
  const credentials = useMemo(() => getCredentials(props.options), [props.options]);

  const onCredentialsChange = (credentials: AzureCredentials, subscriptionId?: string): void => {
    if (!subscriptionId) {
      setSubscriptions([]);
    }
    updateOptions((options) =>
      updateCredentials({ ...options, jsonData: { ...options.jsonData, subscriptionId } }, credentials)
    );
  };

  const onSubscriptionsChange = (receivedSubscriptions: Array<SelectableValue<string>>) =>
    setSubscriptions(receivedSubscriptions);

  const onSubscriptionChange = (subscriptionId?: string) =>
    updateOptions((options) => ({ ...options, jsonData: { ...options.jsonData, subscriptionId } }));

  return (
    <>
      <h3 className="page-heading">Authentication</h3>
      <AzureCredentialsForm
        managedIdentityEnabled={config.azure.managedIdentityEnabled}
        credentials={credentials}
        azureCloudOptions={azureClouds}
        onCredentialsChange={onCredentialsChange}
        disabled={props.options.readOnly}
      >
        <DefaultSubscription
          subscriptions={subscriptions}
          credentials={credentials}
          getSubscriptions={getSubscriptions}
          disabled={props.options.readOnly}
          onSubscriptionsChange={onSubscriptionsChange}
          onSubscriptionChange={onSubscriptionChange}
          options={options.jsonData}
        />
      </AzureCredentialsForm>
    </>
  );
};

export default MonitorConfig;
