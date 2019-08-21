import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { Switch, FormLabel, Select, Button } from '@grafana/ui';

export interface Props {
  datasourceConfig: any;
  logAnalyticsSubscriptions: SelectableValue[];
  logAnalyticsWorkspaces: SelectableValue[];
  onDatasourceUpdate: (config: any) => void;
  onLoadSubscriptions: (type?: string) => void;
  onLoadWorkspaces: (type?: string) => void;
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
      editorJsonData: {
        ...this.state.config.editorJsonData,
        logAnalyticsTenantId,
      },
    });
  };

  onLogAnalyticsClientIdChange = (logAnalyticsClientId: string) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      editorJsonData: {
        ...this.state.config.editorJsonData,
        logAnalyticsClientId,
      },
    });
  };

  onLogAnalyticsClientSecretChange = (logAnalyticsClientSecret: string) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      editorSecureJsonData: {
        ...this.state.config.editorSecureJsonData,
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
      editorJsonData: {
        ...this.state.config.editorJsonData,
        logAnalyticsSubscriptionId: logAnalyticsSubscription.value,
      },
    });
  };

  onWorkspaceSelectChange = (logAnalyticsDefaultWorkspace: SelectableValue<string>) => {
    this.props.onDatasourceUpdate({
      ...this.state.config,
      editorJsonData: {
        ...this.state.config.editorJsonData,
        logAnalyticsDefaultWorkspace: logAnalyticsDefaultWorkspace.value,
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

  hasWorkspaceRequiredFields = () => {
    const {
      config: { editorJsonData, editorSecureJsonData, jsonData, secureJsonFields },
    } = this.state;

    if (jsonData.azureLogAnalyticsSameAs) {
      return (
        editorJsonData.tenantId &&
        editorJsonData.clientId &&
        editorJsonData.subscriptionId &&
        (editorSecureJsonData.clientSecret || secureJsonFields.clientSecret)
      );
    }

    return (
      editorJsonData.logAnalyticsTenantId.length &&
      editorJsonData.logAnalyticsClientId.length &&
      editorJsonData.logAnalyticsSubscriptionId &&
      (secureJsonFields.logAnalyticsClientSecret || editorSecureJsonData.logAnalyticsClientSecret)
    );
  };

  render() {
    const {
      config: { editorJsonData, editorSecureJsonData, jsonData, secureJsonFields },
      logAnalyticsSubscriptions,
      logAnalyticsWorkspaces,
    } = this.state;

    const addtlAttrs = {
      ...(jsonData.azureLogAnalyticsSameAs && {
        tooltip: 'Workspaces are pulled from default subscription selected above.',
      }),
    };
    return (
      <>
        <h3 className="page-heading">Azure Log Analytics API Details</h3>
        <Switch
          label="Same details as Azure Monitor API"
          checked={jsonData.azureLogAnalyticsSameAs}
          onChange={event => this.onAzureLogAnalyticsSameAsChange(!jsonData.azureLogAnalyticsSameAs)}
          {...addtlAttrs}
        />
        {!jsonData.azureLogAnalyticsSameAs && (
          <AzureCredentialsForm
            subscriptionOptions={logAnalyticsSubscriptions}
            selectedSubscription={editorJsonData.logAnalyticsSubscriptionId}
            tenantId={editorJsonData.logAnalyticsTenantId}
            clientId={editorJsonData.logAnalyticsClientId}
            clientSecret={editorSecureJsonData.logAnalyticsClientSecret}
            clientSecretConfigured={secureJsonFields.logAnalyticsClientSecret}
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
                    workspace => workspace.value === editorJsonData.logAnalyticsDefaultWorkspace
                  )}
                  options={logAnalyticsWorkspaces}
                  defaultValue={editorJsonData.logAnalyticsDefaultWorkspace}
                  onChange={this.onWorkspaceSelectChange}
                />
              </div>
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <div className="max-width-30 gf-form-inline">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => this.props.onLoadWorkspaces()}
                  disabled={!this.hasWorkspaceRequiredFields()}
                >
                  Load Workspaces
                </Button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
}

export default AnalyticsConfig;
