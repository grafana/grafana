import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { Switch, FormLabel, Select } from '@grafana/ui';

export interface Props {
  datasourceConfig: any;
  logAnalyticsSubscriptions: SelectableValue[];
  logAnalyticsWorkspaces: SelectableValue[];
  onDatasourceUpdate: (config: any) => void;
  onLoadSubscriptions: (type?: string) => void;
}

export interface State {
  config: any;
  logAnalyticsSubscriptions: SelectableValue[];
  logAnalyticsWorkspaces: SelectableValue[];
}

export class AnalyticsConfig extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { datasourceConfig } = this.props;

    this.state = {
      config: datasourceConfig,
      logAnalyticsSubscriptions: [],
      logAnalyticsWorkspaces: [],
    };
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    return {
      ...state,
      config: props.datasourceConfig,
      logAnalyticsSubscriptions: props.logAnalyticsSubscriptions,
      logAnalyticsWorkspaces: props.logAnalyticsWorkspaces,
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

  onLogAnalyticsSubscriptionSelect = (logAnalyticsSubscription: SelectableValue<string>) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        logAnalyticsSubscriptionId: logAnalyticsSubscription.value,
      },
    });
  };

  onWorkspaceSelectChange = (logAnalyticsDefaultWorkspace: SelectableValue<string>) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      jsonData: {
        ...this.state.config.jsonData,
        logAnalyticsDefaultWorkspace,
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
    const { config, logAnalyticsSubscriptions, logAnalyticsWorkspaces } = this.state;
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
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel
                className="width-12"
                tooltip="Choose the default/preferred Workspace for Azure Log Analytics queries."
              >
                Default Workspace
              </FormLabel>
              <div className="width-25">
                <Select
                  value={logAnalyticsWorkspaces.find(
                    workspace => workspace.value === config.jsonData.logAnalyticsDefaultWorkspace
                  )}
                  options={logAnalyticsWorkspaces}
                  defaultValue={config.jsonData.logAnalyticsDefaultWorkspace}
                  onChange={this.onWorkspaceSelectChange}
                />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
}
