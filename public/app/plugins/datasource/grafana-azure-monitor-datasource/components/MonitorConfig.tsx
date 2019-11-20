import React, { PureComponent, ChangeEvent } from 'react';
import { SelectableValue } from '@grafana/data';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { AzureDataSourceSettings } from '../types';

const azureClouds = [
  { value: 'azuremonitor', label: 'Azure' },
  { value: 'govazuremonitor', label: 'Azure US Government' },
  { value: 'germanyazuremonitor', label: 'Azure Germany' },
  { value: 'chinaazuremonitor', label: 'Azure China' },
] as SelectableValue[];

export interface Props {
  options: AzureDataSourceSettings;
  subscriptions: SelectableValue[];
  onDatasourceUpdate: (config: AzureDataSourceSettings) => void;
  onLoadSubscriptions: () => void;
}

export class MonitorConfig extends PureComponent<Props> {
  onAzureCloudSelect = (cloudName: SelectableValue<string>) => {
    const { onDatasourceUpdate, options } = this.props;
    onDatasourceUpdate({
      ...options,
      jsonData: {
        ...options.jsonData,
        cloudName: cloudName.value,
      },
    });
  };

  onTenantIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onDatasourceUpdate, options } = this.props;
    onDatasourceUpdate({
      ...options,
      jsonData: {
        ...options.jsonData,
        tenantId: event.target.value,
      },
    });
  };

  onClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onDatasourceUpdate, options } = this.props;
    onDatasourceUpdate({
      ...options,
      jsonData: {
        ...options.jsonData,
        clientId: event.target.value,
      },
    });
  };

  onClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onDatasourceUpdate, options } = this.props;
    onDatasourceUpdate({
      ...options,
      secureJsonData: {
        ...options.secureJsonData,
        clientSecret: event.target.value,
      },
    });
  };

  onResetClientSecret = () => {
    const { onDatasourceUpdate, options } = this.props;
    onDatasourceUpdate({
      ...options,
      version: options.version + 1,
      secureJsonData: {
        ...options.secureJsonData,
        clientSecret: '',
      },
      secureJsonFields: {
        ...options.secureJsonFields,
        clientSecret: false,
      },
    });
  };

  onSubscriptionSelect = (subscription: SelectableValue<string>) => {
    const { onDatasourceUpdate, options } = this.props;
    onDatasourceUpdate({
      ...options,
      jsonData: {
        ...options.jsonData,
        subscriptionId: subscription.value,
      },
    });
  };

  render() {
    const { options, subscriptions } = this.props;
    return (
      <>
        <h3 className="page-heading">Azure Monitor Details</h3>
        <AzureCredentialsForm
          selectedAzureCloud={options.jsonData.cloudName || 'azuremonitor'}
          azureCloudOptions={azureClouds}
          subscriptionOptions={subscriptions}
          selectedSubscription={options.jsonData.subscriptionId}
          tenantId={options.jsonData.tenantId}
          clientId={options.jsonData.clientId}
          clientSecret={options.secureJsonData.clientSecret}
          clientSecretConfigured={options.secureJsonFields.clientSecret}
          onAzureCloudChange={this.onAzureCloudSelect}
          onSubscriptionSelectChange={this.onSubscriptionSelect}
          onTenantIdChange={this.onTenantIdChange}
          onClientIdChange={this.onClientIdChange}
          onClientSecretChange={this.onClientSecretChange}
          onResetClientSecret={this.onResetClientSecret}
          onLoadSubscriptions={this.props.onLoadSubscriptions}
        />
      </>
    );
  }
}

export default MonitorConfig;
