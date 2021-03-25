import React, { PureComponent, ChangeEvent } from 'react';
import { SelectableValue } from '@grafana/data';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { InlineFormLabel, LegacyForms, Button } from '@grafana/ui';
const { Select, Switch } = LegacyForms;
import { AzureDataSourceJsonData, AzureDataSourceSecureJsonData, AzureDataSourceSettings } from '../types';

export interface State {
  sameAsSwitched: boolean;
}

export interface Props {
  options: AzureDataSourceSettings;
  subscriptions: SelectableValue[];
  resources: SelectableValue[];
  makeSameAs: () => void;
  onUpdateDatasourceOptions: (options: AzureDataSourceSettings) => void;
  onUpdateJsonDataOption: (key: keyof AzureDataSourceJsonData, val: any) => void;
  onUpdateSecureJsonDataOption: (key: keyof AzureDataSourceSecureJsonData, val: any) => void;
  onResetOptionKey: (key: keyof AzureDataSourceSecureJsonData) => void;
  onLoadSubscriptions: (type?: string) => void;
  onLoadResources: (type?: string) => void;
}

export class AnalyticsResourceConfig extends PureComponent<Props, State> {
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

  onLogAnalyticsSubscriptionSelect = (resourceLogAnalyticsSubscription: SelectableValue<string>) => {
    this.props.onUpdateJsonDataOption('resourceLogAnalyticsSubscriptionId', resourceLogAnalyticsSubscription.value);
  };

  onResourceSelectChange = (logAnalyticsDefaultResource: SelectableValue<string>) => {
    this.props.onUpdateJsonDataOption('logAnalyticsDefaultResource', logAnalyticsDefaultResource.value);
  };

  onAzureResourceLogAnalyticsSameAsChange = () => {
    const { options, onUpdateDatasourceOptions, makeSameAs } = this.props;

    if (!options.jsonData.azureResourceLogAnalyticsSameAs && options.secureJsonData!.clientSecret) {
      makeSameAs();
    } else if (!options.jsonData.azureResourceLogAnalyticsSameAs) {
      // if currently off, clear monitor secret
      onUpdateDatasourceOptions({
        ...options,
        jsonData: {
          ...options.jsonData,
          azureResourceLogAnalyticsSameAs: !options.jsonData.azureResourceLogAnalyticsSameAs,
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
      this.props.onUpdateJsonDataOption(
        'azureResourceLogAnalyticsSameAs',
        !options.jsonData.azureResourceLogAnalyticsSameAs
      );
    }
  };

  onLogAnalyticsResetClientSecret = () => {
    this.props.onResetOptionKey('logAnalyticsClientSecret');
  };

  hasWorkspaceRequiredFields = () => {
    const {
      options: { jsonData, secureJsonData, secureJsonFields },
    } = this.props;

    if (jsonData.azureResourceLogAnalyticsSameAs) {
      return (
        jsonData.tenantId &&
        jsonData.clientId &&
        jsonData.subscriptionId &&
        (secureJsonData!.clientSecret || secureJsonFields.clientSecret)
      );
    }

    return (
      jsonData.logAnalyticsTenantId &&
      jsonData.logAnalyticsTenantId.length &&
      jsonData.logAnalyticsClientId &&
      jsonData.logAnalyticsClientId.length &&
      jsonData.resourceLogAnalyticsSubscriptionId &&
      (secureJsonFields.logAnalyticsClientSecret || secureJsonData!.logAnalyticsClientSecret)
    );
  };

  render() {
    const {
      options: { jsonData, secureJsonData, secureJsonFields },
      subscriptions,
      resources,
    } = this.props;

    const { sameAsSwitched } = this.state;

    if (!jsonData.hasOwnProperty('azureResourceLogAnalyticsSameAs')) {
      jsonData.azureResourceLogAnalyticsSameAs = true;
    }

    const addtlAttrs = {
      ...(jsonData.azureResourceLogAnalyticsSameAs && {
        tooltip: 'Workspaces are pulled from default subscription selected above.',
      }),
    };

    const showSameAsHelpMsg =
      sameAsSwitched &&
      jsonData.azureResourceLogAnalyticsSameAs &&
      secureJsonFields &&
      !secureJsonFields.clientSecret &&
      !secureJsonData!.clientSecret;

    return (
      <>
        <h3 className="page-heading">Azure Monitor Logs Details by Resources</h3>
        <Switch
          label="Same details as Azure Monitor API"
          checked={jsonData.azureResourceLogAnalyticsSameAs ?? false}
          onChange={this.onAzureResourceLogAnalyticsSameAsChange}
          {...addtlAttrs}
        />
        {showSameAsHelpMsg && (
          <div className="grafana-info-box m-t-2">
            <div className="alert-body">
              <p>Re-enter your Azure Monitor Client Secret to use this setting.</p>
            </div>
          </div>
        )}
        {!jsonData.azureResourceLogAnalyticsSameAs && (
          <AzureCredentialsForm
            subscriptionOptions={subscriptions}
            selectedSubscription={jsonData.resourceLogAnalyticsSubscriptionId}
            tenantId={jsonData.logAnalyticsTenantId}
            clientId={jsonData.logAnalyticsClientId}
            clientSecret={secureJsonData!.logAnalyticsClientSecret}
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
                tooltip="Choose the default/preferred Resource for Azure Log Analytics queries."
              >
                Default Resource
              </InlineFormLabel>
              <div className="width-25">
                <Select
                  value={resources.find((resource) => resource.value === jsonData.logAnalyticsDefaultResource)}
                  options={resources}
                  defaultValue={jsonData.logAnalyticsDefaultResource}
                  onChange={this.onResourceSelectChange}
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
                  onClick={() => this.props.onLoadResources()}
                  disabled={!this.hasWorkspaceRequiredFields()}
                >
                  Load Resources
                </Button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
}

export default AnalyticsResourceConfig;
