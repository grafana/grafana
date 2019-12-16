import React, { PureComponent, ChangeEvent } from 'react';
import { SelectableValue } from '@grafana/data';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { Switch, FormLabel, Select, Button } from '@grafana/ui';
import { AzureDataSourceSettings } from '../types';

export interface Props {
  options: AzureDataSourceSettings;
  subscriptions: SelectableValue[];
  workspaces: SelectableValue[];
  makeSameAs: () => void;
  onUpdateOptions: (options: AzureDataSourceSettings) => void;
  onUpdateOption: (key: string, val: any, secure: boolean) => void;
  onResetOptionKey: (key: string) => void;
  onLoadSubscriptions: (type?: string) => void;
  onLoadWorkspaces: (type?: string) => void;
}
export class AnalyticsConfig extends PureComponent<Props> {
  onLogAnalyticsTenantIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onUpdateOption('logAnalyticsTenantId', event.target.value, false);
  };

  onLogAnalyticsClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onUpdateOption('logAnalyticsClientId', event.target.value, false);
  };

  onLogAnalyticsClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onUpdateOption('logAnalyticsClientSecret', event.target.value, true);
  };

  onLogAnalyticsSubscriptionSelect = (logAnalyticsSubscription: SelectableValue<string>) => {
    this.props.onUpdateOption('logAnalyticsSubscriptionId', logAnalyticsSubscription.value, false);
  };

  onWorkspaceSelectChange = (logAnalyticsDefaultWorkspace: SelectableValue<string>) => {
    this.props.onUpdateOption('logAnalyticsDefaultWorkspace', logAnalyticsDefaultWorkspace.value, false);
  };

  onAzureLogAnalyticsSameAsChange = () => {
    const { options, onUpdateOptions, makeSameAs } = this.props;

    if (!options.jsonData.azureLogAnalyticsSameAs && options.secureJsonData.clientSecret) {
      makeSameAs();
    } else if (!options.jsonData.azureLogAnalyticsSameAs) {
      // if currently off, clear monitor secret
      onUpdateOptions({
        ...options,
        jsonData: {
          ...options.jsonData,
          azureLogAnalyticsSameAs: !options.jsonData.azureLogAnalyticsSameAs,
        },
        secureJsonData: {
          ...options.secureJsonData,
          clientSecret: '',
        },
        secureJsonFields: {
          clientSecret: false,
        },
      });
    } else {
      this.props.onUpdateOption('azureLogAnalyticsSameAs', !options.jsonData.azureLogAnalyticsSameAs, false);
    }

    // init popover to warn secret needs to be re-entered
  };

  onLogAnalyticsResetClientSecret = () => {
    this.props.onResetOptionKey('logAnalyticsClientSecret');
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
      jsonData.logAnalyticsClientId &&
      jsonData.logAnalyticsClientId.length &&
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

    const showSameAsHelpMsg =
      jsonData.azureLogAnalyticsSameAs &&
      secureJsonFields &&
      !secureJsonFields.clientSecret &&
      !secureJsonData.clientSecret;

    return (
      <>
        <h3 className="page-heading">Azure Log Analytics API Details</h3>
        <Switch
          label="Same details as Azure Monitor API"
          checked={jsonData.azureLogAnalyticsSameAs}
          onChange={this.onAzureLogAnalyticsSameAsChange}
          {...addtlAttrs}
        />
        {showSameAsHelpMsg && (
          <div className="grafana-info-box m-t-2">
            <div className="alert-body">
              <p>Re-enter your Azure Monitor Client Secret to use this setting.</p>
            </div>
          </div>
        )}
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
