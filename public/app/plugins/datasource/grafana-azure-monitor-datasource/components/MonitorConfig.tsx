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
  onUpdateOption: (key: string, val: any, secure: boolean) => void;
  onResetOptionKey: (key: string) => void;
  onLoadSubscriptions: () => void;
}

export class MonitorConfig extends PureComponent<Props> {
  onAzureCloudSelect = (cloudName: SelectableValue<string>) => {
    this.props.onUpdateOption('cloudName', cloudName.value, false);
  };

  onTenantIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onUpdateOption('tenantId', event.target.value, false);
  };

  onClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onUpdateOption('clientId', event.target.value, false);
  };

  onClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { options, makeSameAs } = this.props;

    if (options.jsonData.azureLogAnalyticsSameAs && event.target.value) {
      makeSameAs(event.target.value);
    } else {
      this.props.onUpdateOption('clientSecret', event.target.value, true);
    }
  };

  onResetClientSecret = () => {
    this.props.onResetOptionKey('clientSecret');
  };

  onSubscriptionSelect = (subscription: SelectableValue<string>) => {
    this.props.onUpdateOption('subscriptionId', subscription.value, false);
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
