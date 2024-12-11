import { useMemo, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { AzureCredentials } from '@grafana/azure-sdk';
import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';

import { getCredentials, updateCredentials } from '../../credentials';
import { AzureMonitorDataSourceSettings } from '../../types';

import { AzureCredentialsForm, getAzureCloudOptions } from './AzureCredentialsForm';
import { BasicLogsToggle } from './BasicLogsToggle';
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
    updateOptions((options: AzureMonitorDataSourceSettings) =>
      updateCredentials({ ...options, jsonData: { ...options.jsonData, subscriptionId } }, credentials)
    );
  };

  const onSubscriptionsChange = (receivedSubscriptions: Array<SelectableValue<string>>) =>
    setSubscriptions(receivedSubscriptions);

  const onSubscriptionChange = (subscriptionId?: string) =>
    updateOptions((options) => ({ ...options, jsonData: { ...options.jsonData, subscriptionId } }));

  const onBasicLogsEnabledChange = (enableBasicLogs: boolean) =>
    updateOptions((options) => ({ ...options, jsonData: { ...options.jsonData, basicLogsEnabled: enableBasicLogs } }));

  // The auth type needs to be set on the first load of the data source
  useEffectOnce(() => {
    if (!options.jsonData.authType || !credentials.authType) {
      onCredentialsChange(credentials, options.jsonData.subscriptionId);
    }
  });

  return (
    <>
      <AzureCredentialsForm
        managedIdentityEnabled={config.azure.managedIdentityEnabled}
        workloadIdentityEnabled={config.azure.workloadIdentityEnabled}
        userIdentityEnabled={config.azure.userIdentityEnabled && !!config.featureToggles.azureMonitorEnableUserAuth}
        credentials={credentials}
        azureCloudOptions={getAzureCloudOptions()}
        onCredentialsChange={onCredentialsChange}
        disabled={props.options.readOnly}
      >
        <>
          <DefaultSubscription
            subscriptions={subscriptions}
            credentials={credentials}
            getSubscriptions={getSubscriptions}
            disabled={props.options.readOnly}
            onSubscriptionsChange={onSubscriptionsChange}
            onSubscriptionChange={onSubscriptionChange}
            options={options.jsonData}
          />
          <BasicLogsToggle options={options.jsonData} onBasicLogsEnabledChange={onBasicLogsEnabledChange} />
        </>
      </AzureCredentialsForm>
    </>
  );
};

export default MonitorConfig;
