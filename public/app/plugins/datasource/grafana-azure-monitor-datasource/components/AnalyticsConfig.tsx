import React, { PureComponent, ChangeEvent } from 'react';
import { SelectableValue } from '@grafana/data';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { InlineFormLabel, LegacyForms, Button } from '@grafana/ui';
const { Select, Switch } = LegacyForms;
import { AzureDataSourceSettings } from '../types';

export interface State {
  sameAsSwitched: boolean;
}

export interface Props {
  options: AzureDataSourceSettings;
  subscriptions: SelectableValue[];
  workspaces: SelectableValue[];
  makeSameAs: () => void;
  onUpdateDatasourceOptions: (options: AzureDataSourceSettings) => void;
  onUpdateJsonDataOption: (key: string, val: any) => void;
  onUpdateSecureJsonDataOption: (key: string, val: any) => void;
  onResetOptionKey: (key: string) => void;
  onLoadSubscriptions: (type?: string) => void;
  onLoadWorkspaces: (type?: string) => void;
}
export class AnalyticsConfig extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      sameAsSwitched: false,
    };
  }

  onLogAnalyticsTenantIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onUpdateJsonDataOption('logAnalyticsTenantId', event.target.value);
  };

  onLogAnalyticsClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onUpdateJsonDataOption('logAnalyticsClientId', event.target.value);
  };

  onLogAnalyticsClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onUpdateSecureJsonDataOption('logAnalyticsClientSecret', event.target.value);
  };

  onLogAnalyticsSubscriptionSelect = (logAnalyticsSubscription: SelectableValue<string>) => {
    this.props.onUpdateJsonDataOption('logAnalyticsSubscriptionId', logAnalyticsSubscription.value);
  };

  onWorkspaceSelectChange = (logAnalyticsDefaultWorkspace: SelectableValue<string>) => {
    this.props.onUpdateJsonDataOption('logAnalyticsDefaultWorkspace', logAnalyticsDefaultWorkspace.value);
  };

  onAzureLogAnalyticsSameAsChange = () => {
    const { options, onUpdateDatasourceOptions, makeSameAs } = this.props;

    if (!options.jsonData.azureLogAnalyticsSameAs && options.secureJsonData.clientSecret) {
      makeSameAs();
    } else if (!options.jsonData.azureLogAnalyticsSameAs) {
      // if currently off, clear monitor secret
      onUpdateDatasourceOptions({
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

      this.setState({
        sameAsSwitched: true,
      });
    } else {
      this.props.onUpdateJsonDataOption('azureLogAnalyticsSameAs', !options.jsonData.azureLogAnalyticsSameAs);
    }
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

    const { sameAsSwitched } = this.state;

    if (!jsonData.hasOwnProperty('azureLogAnalyticsSameAs')) {
      jsonData.azureLogAnalyticsSameAs = true;
    }

    const addtlAttrs = {
      ...(jsonData.azureLogAnalyticsSameAs && {
        tooltip: 'Workspaces are pulled from default subscription selected above.',
      }),
    };

    const showSameAsHelpMsg =
      sameAsSwitched &&
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
              <InlineFormLabel
                className="width-12"
                tooltip="Choose the default/preferred Workspace for Azure Log Analytics queries."
              >
                Default Workspace
              </InlineFormLabel>
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
