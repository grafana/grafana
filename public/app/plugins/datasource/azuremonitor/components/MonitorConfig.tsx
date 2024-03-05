import React, { useMemo, useEffect, useState } from 'react';

import { AzureCredentials } from '@grafana/azure-sdk';
import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';

import { AzureMonitorDataSourceSettings } from '../types';

import { KnownAzureClouds } from './AzureCredentials';
import { getCredentials, getDefaultCredentials, hasCredentials, updateCredentials } from './AzureCredentialsConfig';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { DefaultSubscription } from './DefaultSubscription';

export interface Props {
  options: AzureMonitorDataSourceSettings;
  updateOptions: (optionsFunc: (options: AzureMonitorDataSourceSettings) => AzureMonitorDataSourceSettings) => void;
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

  useEffect(() => {
    if (!hasCredentials(options)) {
      updateOptions((options) => updateCredentials(options, getDefaultCredentials()));
    }
  }, [options, updateOptions]);

  return (
    <>
      <AzureCredentialsForm
        managedIdentityEnabled={config.azure.managedIdentityEnabled}
        workloadIdentityEnabled={config.azure.workloadIdentityEnabled}
        credentials={credentials}
        azureCloudOptions={KnownAzureClouds}
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
