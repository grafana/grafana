// Libraries
import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { Switch } from '@grafana/ui';

export interface Props {
  datasourceConfig: any;
  logAnalyticsSubscriptions: SelectableValue[];
  onDatasourceUpdate: (config: any) => void;
  onLoadSubscriptions: (type?: string) => void;
}

export interface State {
  config: any;
  logAnalyticsSubscriptions: SelectableValue[];
}

export class AnalyticsConfig extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { datasourceConfig } = this.props;

    this.state = {
      config: datasourceConfig,
      logAnalyticsSubscriptions: [],
    };
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    return {
      ...state,
      config: props.datasourceConfig,
      logAnalyticsSubscriptions: props.logAnalyticsSubscriptions,
    };
  }

  onLogAnalyticsTenantIdChange = (logAnalyticsTenantId: string) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        logAnalyticsTenantId,
      },
    });
  };

  onLogAnalyticsClientIdChange = (logAnalyticsClientId: string) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        logAnalyticsClientId,
      },
    });
  };

  onLogAnalyticsClientSecretChange = (logAnalyticsClientSecret: string) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      secureJsonData: {
        ...this.state.config.secureJsonData,
        logAnalyticsClientSecret,
      },
    });
  };

  onLogAnalyticsResetClientSecret = () => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      version: this.state.config.version + 1,
      secureJsonFields: { ...this.state.config.secureJsonFields, logAnalyticsClientSecret: false },
    });
  };

  onLogAnalyticsSubscriptionSelect = (logAnalyticsSubscriptionId: SelectableValue<string>) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        logAnalyticsSubscriptionId,
      },
    });
  };

  onAzureLogAnalyticsSameAsChange = (azureLogAnalyticsSameAs: boolean) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        azureLogAnalyticsSameAs,
      },
    });
  };

  render() {
    const { config, logAnalyticsSubscriptions } = this.state;
    return (
      <>
        <h3 className="page-heading">Azure Log Analytics API Details</h3>
        <Switch
          label="Same details as Azure Monitor API"
          checked={config.jsonData.azureLogAnalyticsSameAs}
          onChange={event => this.onAzureLogAnalyticsSameAsChange(!config.jsonData.azureLogAnalyticsSameAs)}
        />
        {!config.jsonData.azureLogAnalyticsSameAs && (
          <AzureCredentialsForm
            subscriptionOptions={logAnalyticsSubscriptions}
            selectedSubscription={config.jsonData.logAnalyticsSubscriptionId}
            tenantId={config.jsonData.logAnalyticsTenantId}
            clientId={config.jsonData.logAnalyticsClientId}
            clientSecret={config.secureJsonData.logAnalyticsClientSecret}
            clientSecretConfigured={config.secureJsonFields.logAnalyticsClientSecret}
            onSubscriptionSelectChange={this.onLogAnalyticsSubscriptionSelect}
            onTenantIdChange={this.onLogAnalyticsTenantIdChange}
            onClientIdChange={this.onLogAnalyticsClientIdChange}
            onClientSecretChange={this.onLogAnalyticsClientSecretChange}
            onResetClientSecret={this.onLogAnalyticsResetClientSecret}
            onLoadSubscriptions={() => this.props.onLoadSubscriptions('workspacesloganalytics')}
          />
        )}
      </>
    );
  }
}
