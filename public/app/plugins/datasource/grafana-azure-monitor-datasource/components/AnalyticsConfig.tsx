import React, { PureComponent, ChangeEvent } from 'react';
import { SelectableValue } from '@grafana/data';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { Switch, FormLabel, Select, Button } from '@grafana/ui';
import { AzureDataSourceSettings } from '../types';

export interface Props {
  options: AzureDataSourceSettings;
  subscriptions: SelectableValue[];
  workspaces: SelectableValue[];
  onDatasourceUpdate: (config: any) => void;
  onLoadSubscriptions: (type?: string) => void;
  onLoadWorkspaces: (type?: string) => void;
}
export class AnalyticsConfig extends PureComponent<Props> {
  onLogAnalyticsTenantIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onDatasourceUpdate({
      ...this.props.options,
      jsonData: {
        ...this.props.options.jsonData,
        logAnalyticsTenantId: event.target.value,
      },
    });
  };

  onLogAnalyticsClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onDatasourceUpdate({
      ...this.props.options,
      jsonData: {
        ...this.props.options.jsonData,
        logAnalyticsClientId: event.target.value,
      },
    });
  };

  onLogAnalyticsClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onDatasourceUpdate({
      ...this.props.options,
      secureJsonData: {
        ...this.props.options.secureJsonData,
        logAnalyticsClientSecret: event.target.value,
      },
    });
  };

  onLogAnalyticsResetClientSecret = () => {
    this.props.onDatasourceUpdate({
      ...this.props.options,
      version: this.props.options.version + 1,
      secureJsonData: {
        ...this.props.options.secureJsonData,
        logAnalyticsClientSecret: '',
      },
      secureJsonFields: {
        ...this.props.options.secureJsonFields,
        logAnalyticsClientSecret: false,
      },
    });
  };

  onLogAnalyticsSubscriptionSelect = (logAnalyticsSubscription: SelectableValue<string>) => {
    this.props.onDatasourceUpdate({
      ...this.props.options,
      jsonData: {
        ...this.props.options.jsonData,
        logAnalyticsSubscriptionId: logAnalyticsSubscription.value,
      },
    });
  };

  onWorkspaceSelectChange = (logAnalyticsDefaultWorkspace: SelectableValue<string>) => {
    this.props.onDatasourceUpdate({
      ...this.props.options,
      jsonData: {
        ...this.props.options.jsonData,
        logAnalyticsDefaultWorkspace: logAnalyticsDefaultWorkspace.value,
      },
    });
  };

  onAzureLogAnalyticsSameAsChange = (azureLogAnalyticsSameAs: boolean) => {
    this.props.onDatasourceUpdate({
      ...this.props.options,
      jsonData: {
        ...this.props.options.jsonData,
        azureLogAnalyticsSameAs,
      },
    });
  };

  hasWorkspaceRequiredFields = () => {
    const {
      options: { jsonData, secureJsonData, secureJsonFields },
    } = this.props;

    if (jsonData.azureLogAnalyticsSameAs) {
      return (
        jsonData.tenantId &&
        jsonData.clientId &&
        jsonData.subscriptionId &&
        (secureJsonData.clientSecret || secureJsonFields.clientSecret)
      );
    }

    return (
      jsonData.logAnalyticsTenantId &&
      jsonData.logAnalyticsTenantId.length &&
      (jsonData.logAnalyticsClientId && jsonData.logAnalyticsClientId.length) &&
      jsonData.logAnalyticsSubscriptionId &&
      (secureJsonFields.logAnalyticsClientSecret || secureJsonData.logAnalyticsClientSecret)
    );
  };

  render() {
    const {
      options: { jsonData, secureJsonData, secureJsonFields },
      subscriptions,
      workspaces,
    } = this.props;

    if (!jsonData.hasOwnProperty('azureLogAnalyticsSameAs')) {
      jsonData.azureLogAnalyticsSameAs = true;
    }

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
          onChange={() => this.onAzureLogAnalyticsSameAsChange(!jsonData.azureLogAnalyticsSameAs)}
          {...addtlAttrs}
        />
        {!jsonData.azureLogAnalyticsSameAs && (
          <AzureCredentialsForm
            subscriptionOptions={subscriptions}
            selectedSubscription={jsonData.logAnalyticsSubscriptionId}
            tenantId={jsonData.logAnalyticsTenantId}
            clientId={jsonData.logAnalyticsClientId}
            clientSecret={secureJsonData.logAnalyticsClientSecret}
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
                  value={workspaces.find(workspace => workspace.value === jsonData.logAnalyticsDefaultWorkspace)}
                  options={workspaces}
                  defaultValue={jsonData.logAnalyticsDefaultWorkspace}
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
