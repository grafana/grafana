import React, { PureComponent } from 'react';
import { SelectableValue, DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { MonitorConfig } from './MonitorConfig';
import { AnalyticsConfig } from './AnalyticsConfig';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { getBackendSrv, BackendSrv } from 'app/core/services/backend_srv';
import { InsightsConfig } from './InsightsConfig';
import ResponseParser from '../azure_monitor/response_parser';
import { AzureDataSourceJsonData, AzureDataSourceSecureJsonData, AzureDataSourceSettings } from '../types';

export type Props = DataSourcePluginOptionsEditorProps<AzureDataSourceJsonData, AzureDataSourceSecureJsonData>;

export interface State {
  subscriptions: SelectableValue[];
  logAnalyticsSubscriptions: SelectableValue[];
  logAnalyticsWorkspaces: SelectableValue[];
}

export class ConfigEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      subscriptions: [],
      logAnalyticsSubscriptions: [],
      logAnalyticsWorkspaces: [],
    };

    this.backendSrv = getBackendSrv();
    this.templateSrv = new TemplateSrv();

    if (this.props.options.id) {
      this.props.options.url = '/api/datasources/proxy/' + this.props.options.id;
    }

    this.onOptionsUpdate(this.props.options);
  }

  backendSrv: BackendSrv = null;
  templateSrv: TemplateSrv = null;

  async componentDidMount() {
    await this.getSubscriptions();

    if (!this.props.options.jsonData.azureLogAnalyticsSameAs) {
      await this.getLogAnalyticsSubscriptions();
    }
  }

  onOptionsUpdate = async (options: AzureDataSourceSettings) => {
    if (options.hasOwnProperty('secureJsonData')) {
      if (options.secureJsonData.hasOwnProperty('clientSecret') && options.secureJsonData.clientSecret.length === 0) {
        delete options.secureJsonData.clientSecret;
      }

      if (
        options.secureJsonData.hasOwnProperty('logAnalyticsClientSecret') &&
        options.secureJsonData.logAnalyticsClientSecret.length === 0
      ) {
        delete options.secureJsonData.logAnalyticsClientSecret;
      }

      if (
        options.secureJsonData.hasOwnProperty('appInsightsApiKey') &&
        options.secureJsonData.appInsightsApiKey.length === 0
      ) {
        delete options.secureJsonData.appInsightsApiKey;
      }
    }

    this.props.onOptionsChange({
      ...options,
    });
  };

  hasNecessaryCredentials = () => {
    if (!this.props.options.secureJsonFields.clientSecret && !this.props.options.secureJsonData.clientSecret) {
      return false;
    }

    if (!this.props.options.jsonData.clientId || !this.props.options.jsonData.tenantId) {
      return false;
    }

    return true;
  };

  logAnalyticsHasNecessaryCredentials = () => {
    if (
      !this.props.options.secureJsonFields.logAnalyticsClientSecret &&
      !this.props.options.secureJsonData.logAnalyticsClientSecret
    ) {
      return false;
    }

    if (!this.props.options.jsonData.logAnalyticsClientId || !this.props.options.jsonData.logAnalyticsTenantId) {
      return false;
    }

    return true;
  };

  onLoadSubscriptions = async (type?: string) => {
    await this.backendSrv.put(`/api/datasources/${this.props.options.id}`, this.props.options).then(() => {
      this.onOptionsUpdate({
        ...this.props.options,
        version: this.props.options.version + 1,
      });
    });

    if (type && type === 'workspacesloganalytics') {
      this.getLogAnalyticsSubscriptions();
    } else {
      this.getSubscriptions();
    }
  };

  loadSubscriptions = async (route?: string) => {
    const url = `/${route || this.props.options.jsonData.cloudName}/subscriptions?api-version=2019-03-01`;

    return this.backendSrv
      .datasourceRequest({
        url: this.props.options.url + url,
        method: 'GET',
      })
      .then((result: any) => {
        return ResponseParser.parseSubscriptionsForSelect(result);
      })
      .catch((error: any) => {
        throw error;
      });
  };

  loadWorkspaces = async (subscription: string) => {
    const { azureLogAnalyticsSameAs, cloudName, logAnalyticsSubscriptionId } = this.props.options.jsonData;
    let azureMonitorUrl = '',
      subscriptionId = this.templateSrv.replace(subscription || this.props.options.jsonData.subscriptionId);

    if (!!subscriptionId || !!azureLogAnalyticsSameAs) {
      const azureCloud = cloudName || 'azuremonitor';
      azureMonitorUrl = `/${azureCloud}/subscriptions`;
    } else {
      subscriptionId = logAnalyticsSubscriptionId;
      azureMonitorUrl = `/workspacesloganalytics/subscriptions`;
    }

    const workspaceListUrl =
      azureMonitorUrl +
      `/${subscriptionId}/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview`;

    return this.backendSrv
      .datasourceRequest({
        url: this.props.options.url + workspaceListUrl,
        method: 'GET',
      })
      .then((result: any) => {
        return result.data.value.map((val: any) => {
          return {
            value: val.properties.customerId,
            label: val.name,
          };
        });
      })
      .catch((error: any) => {
        throw error;
      });
  };

  getSubscriptions = async () => {
    if (!this.hasNecessaryCredentials()) {
      return;
    }

    const subscriptions = (await this.loadSubscriptions()) || [];

    if (subscriptions && subscriptions.length > 0) {
      this.setState({ subscriptions });

      this.props.options.jsonData.subscriptionId = this.props.options.jsonData.subscriptionId || subscriptions[0].value;
    }

    if (this.props.options.jsonData.subscriptionId && this.props.options.jsonData.azureLogAnalyticsSameAs) {
      await this.getWorkspaces();
    }
  };

  getLogAnalyticsSubscriptions = async () => {
    if (!this.logAnalyticsHasNecessaryCredentials()) {
      return;
    }

    const logAnalyticsSubscriptions = (await this.loadSubscriptions('workspacesloganalytics')) || [];

    if (logAnalyticsSubscriptions && logAnalyticsSubscriptions.length > 0) {
      this.setState({ logAnalyticsSubscriptions });

      this.props.options.jsonData.logAnalyticsSubscriptionId =
        this.props.options.jsonData.logAnalyticsSubscriptionId || logAnalyticsSubscriptions[0].value;
    }

    if (this.props.options.jsonData.logAnalyticsSubscriptionId) {
      await this.getWorkspaces();
    }
  };

  getWorkspaces = async () => {
    const sameAs = this.props.options.jsonData.azureLogAnalyticsSameAs && this.props.options.jsonData.subscriptionId;
    if (!sameAs && !this.props.options.jsonData.logAnalyticsSubscriptionId) {
      return;
    }

    const logAnalyticsWorkspaces = await this.loadWorkspaces(
      sameAs ? this.props.options.jsonData.subscriptionId : this.props.options.jsonData.logAnalyticsSubscriptionId
    );

    if (logAnalyticsWorkspaces.length > 0) {
      this.setState({ logAnalyticsWorkspaces });

      this.props.options.jsonData.logAnalyticsDefaultWorkspace =
        this.props.options.jsonData.logAnalyticsDefaultWorkspace || logAnalyticsWorkspaces[0].value;
    }
  };

  render() {
    const { subscriptions, logAnalyticsSubscriptions, logAnalyticsWorkspaces } = this.state;
    const { options } = this.props;

    options.jsonData.cloudName = options.jsonData.cloudName || 'azuremonitor';
    options.secureJsonData = (options.secureJsonData || {}) as AzureDataSourceSecureJsonData;

    return (
      <>
        <MonitorConfig
          options={options}
          subscriptions={subscriptions}
          onLoadSubscriptions={this.onLoadSubscriptions}
          onDatasourceUpdate={this.onOptionsUpdate}
        />

        <AnalyticsConfig
          options={options}
          workspaces={logAnalyticsWorkspaces}
          subscriptions={logAnalyticsSubscriptions}
          onLoadSubscriptions={this.onLoadSubscriptions}
          onDatasourceUpdate={this.onOptionsUpdate}
          onLoadWorkspaces={this.getWorkspaces}
        />

        <InsightsConfig options={options} onDatasourceUpdate={this.onOptionsUpdate} />
      </>
    );
  }
}

export default ConfigEditor;
