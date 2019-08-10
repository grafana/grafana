import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { AzureCredentialsForm } from './AzureCredentialsForm';

export interface Props {
  datasourceConfig: any;
  subscriptions: SelectableValue[];
  onDatasourceUpdate: (config: any) => void;
  onLoadSubscriptions: () => void;
}

export interface State {
  config: any;
  azureClouds: SelectableValue[];
  subscriptions: SelectableValue[];
}

export class MonitorConfig extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { datasourceConfig } = this.props;

    this.state = {
      config: datasourceConfig,
      azureClouds: [
        { value: 'azuremonitor', label: 'Azure' },
        { value: 'govazuremonitor', label: 'Azure US Government' },
        { value: 'germanyazuremonitor', label: 'Azure Germany' },
        { value: 'chinaazuremonitor', label: 'Azure China' },
      ],
      subscriptions: [],
    };
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    return {
      ...state,
      config: props.datasourceConfig,
      subscriptions: props.subscriptions,
    };
  }

  onAzureCloudSelect = (cloudName: SelectableValue<string>) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        cloudName,
      },
    });
  };

  onTenantIdChange = (tenantId: string) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      editorJsonData: {
        ...this.state.config.editorJsonData,
        tenantId,
      },
    });
  };

  onClientIdChange = (clientId: string) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      editorJsonData: {
        ...this.state.config.editorJsonData,
        clientId,
      },
    });
  };

  onClientSecretChange = (clientSecret: string) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      editorSecureJsonData: {
        ...this.state.config.editorSecureJsonData,
        clientSecret,
      },
    });
  };

  onResetClientSecret = () => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      version: this.state.config.version + 1,
      secureJsonFields: {
        ...this.state.config.secureJsonFields,
        clientSecret: false,
      },
    });
  };

  onSubscriptionSelect = (subscription: SelectableValue<string>) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      editorJsonData: {
        ...this.state.config.editorJsonData,
        subscriptionId: subscription.value,
      },
    });
  };

  render() {
    const { azureClouds, config, subscriptions } = this.state;
    return (
      <>
        <h3 className="page-heading">Azure Monitor Details</h3>
        <AzureCredentialsForm
          selectedAzureCloud={config.jsonData.cloudName}
          azureCloudOptions={azureClouds}
          subscriptionOptions={subscriptions}
          selectedSubscription={config.editorJsonData.subscriptionId}
          tenantId={config.editorJsonData.tenantId}
          clientId={config.editorJsonData.clientId}
          clientSecret={config.editorSecureJsonData.clientSecret}
          clientSecretConfigured={config.secureJsonFields.clientSecret}
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
