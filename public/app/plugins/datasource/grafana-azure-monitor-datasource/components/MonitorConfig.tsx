import React, { FunctionComponent, useMemo, useState } from 'react';

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

export const MonitorConfig: FunctionComponent<Props> = (props: Props) => {
  const { updateOptions, getSubscriptions } = props;
  const [subscriptions, setSubscriptions] = useState<Array<SelectableValue<string>>>([]);
  const credentials = useMemo(() => getCredentials(props.options), [props.options]);

  const onCredentialsChange = (credentials: AzureCredentials): void => {
    if (!credentials.defaultSubscriptionId) {
      setSubscriptions([]);
    }
    updateOptions((options) => updateCredentials(options, credentials));
  };

  const onSubscriptionsChange = (receivedSubscriptions: Array<SelectableValue<string>>) =>
    setSubscriptions(receivedSubscriptions);

  return (
    <>
      <h3 className="page-heading">Authentication</h3>
      <AzureCredentialsForm
        managedIdentityEnabled={config.azure.managedIdentityEnabled}
        credentials={credentials}
        azureCloudOptions={azureClouds}
        onCredentialsChange={onCredentialsChange}
        getSubscriptions={getSubscriptions}
        disabled={props.options.readOnly}
      >
        <DefaultSubscription
          subscriptions={subscriptions}
          credentials={credentials}
          getSubscriptions={getSubscriptions}
          onCredentialsChange={onCredentialsChange}
          disabled={props.options.readOnly}
          onSubscriptionsChange={onSubscriptionsChange}
        />
      </AzureCredentialsForm>
    </>
  );
};

export default MonitorConfig;
