import React, { FunctionComponent, useMemo } from 'react';
import { SelectableValue } from '@grafana/data';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { AzureDataSourceSettings, AzureCredentials } from '../types';
import { getCredentials, updateCredentials, isLogAnalyticsSameAs } from '../credentials';

const azureClouds = [
  { value: 'azuremonitor', label: 'Azure' },
  { value: 'govazuremonitor', label: 'Azure US Government' },
  { value: 'germanyazuremonitor', label: 'Azure Germany' },
  { value: 'chinaazuremonitor', label: 'Azure China' },
] as SelectableValue[];

export interface Props {
  options: AzureDataSourceSettings;
  updateOptions: (optionsFunc: (options: AzureDataSourceSettings) => AzureDataSourceSettings) => void;
  getSubscriptions: () => Promise<Array<SelectableValue<string>>>;
}

export const MonitorConfig: FunctionComponent<Props> = (props: Props) => {
  const { updateOptions, getSubscriptions } = props;
  const credentials = useMemo(() => getCredentials(props.options), [props.options]);
  const subscriptionId = props.options.jsonData.subscriptionId;

  const onCredentialsChange = (credentials: AzureCredentials): void => {
    updateOptions((options) => updateCredentials(options, credentials));
  };

  const onDefaultSubscriptionChange = (subscriptionId: string | undefined) => {
    updateOptions((options) => {
      options = {
        ...options,
        jsonData: {
          ...options.jsonData,
          subscriptionId: subscriptionId || '',
        },
      };
      if (isLogAnalyticsSameAs(options)) {
        options = {
          ...options,
          jsonData: {
            ...options.jsonData,
            logAnalyticsSubscriptionId: subscriptionId || '',
          },
        };
      }
      return options;
    });
  };

  return (
    <>
      <h3 className="page-heading">Azure Monitor Metrics Details</h3>
      <AzureCredentialsForm
        credentials={credentials}
        defaultSubscription={subscriptionId}
        azureCloudOptions={azureClouds}
        onCredentialsChange={onCredentialsChange}
        onDefaultSubscriptionChange={onDefaultSubscriptionChange}
        getSubscriptions={getSubscriptions}
      />
    </>
  );
};

export default MonitorConfig;
