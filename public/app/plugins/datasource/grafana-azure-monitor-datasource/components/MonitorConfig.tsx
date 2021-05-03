import React, { FunctionComponent, useMemo } from 'react';
import { SelectableValue } from '@grafana/data';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { AzureDataSourceSettings, AzureCredentials, AzureDataSourceJsonData } from '../types';
import { getCredentials, updateCredentials, isLogAnalyticsSameAs } from '../credentials';

const azureClouds = [
  { value: 'azuremonitor', label: 'Azure' },
  { value: 'govazuremonitor', label: 'Azure US Government' },
  { value: 'germanyazuremonitor', label: 'Azure Germany' },
  { value: 'chinaazuremonitor', label: 'Azure China' },
] as SelectableValue[];

export interface Props {
  options: AzureDataSourceSettings;
  onOptionsChange: (options: AzureDataSourceSettings) => void;
  updateJsonDataOption: (key: keyof AzureDataSourceJsonData, val: any) => void;
  getSubscriptions: (route?: string) => Promise<Array<SelectableValue<string>>>;
}

export const MonitorConfig: FunctionComponent<Props> = (props: Props) => {
  const credentials = useMemo(() => getCredentials(props.options), [props.options]);
  const subscriptionId = props.options.jsonData.subscriptionId;

  const onCredentialsChange = (updatedCredentials: AzureCredentials): void => {
    const { options, onOptionsChange } = props;
    onOptionsChange(updateCredentials(options, updatedCredentials));
  };

  const onDefaultSubscriptionChange = (subscriptionId: string | undefined) => {
    const { options, updateJsonDataOption } = props;
    updateJsonDataOption('subscriptionId', subscriptionId || '');
    if (isLogAnalyticsSameAs(options)) {
      updateJsonDataOption('logAnalyticsSubscriptionId', subscriptionId || '');
    }
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
        getSubscriptions={() => props.getSubscriptions()}
      />
    </>
  );
};

export default MonitorConfig;
