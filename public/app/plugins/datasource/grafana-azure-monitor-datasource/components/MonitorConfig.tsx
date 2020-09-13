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
  makeSameAs: (updatedClientSecret?: string) => void;
  onUpdateJsonDataOption: (key: string, val: any) => void;
  onUpdateSecureJsonDataOption: (key: string, val: any) => void;
  onResetOptionKey: (key: string) => void;
  onLoadSubscriptions: () => void;
}

export class MonitorConfig extends PureComponent<Props> {
  onAzureCloudSelect = (cloudName: SelectableValue<string>) => {
    this.props.onUpdateJsonDataOption('cloudName', cloudName.value);
  };

  onTenantIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onUpdateJsonDataOption('tenantId', event.target.value);
  };

  onClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onUpdateJsonDataOption('clientId', event.target.value);
  };

  onClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { options, makeSameAs } = this.props;

    if (options.jsonData.azureLogAnalyticsSameAs && event.target.value) {
      makeSameAs(event.target.value);
    } else {
      this.props.onUpdateSecureJsonDataOption('clientSecret', event.target.value);
    }
  };

  onResetClientSecret = () => {
    this.props.onResetOptionKey('clientSecret');
  };

  onSubscriptionSelect = (subscription: SelectableValue<string>) => {
    this.props.onUpdateJsonDataOption('subscriptionId', subscription.value);
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
          clientSecret={options.secureJsonData?.clientSecret}
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
