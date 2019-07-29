import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { DataSourcePluginOptionsEditorProps } from '@grafana/ui';
import { MonitorConfig } from './components/MonitorConfig';
import { AnalyticsConfig } from './components/AnalyticsConfig';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { getBackendSrv, BackendSrv } from 'app/core/services/backend_srv';
import AzureMonitorDatasource from './azure_monitor/azure_monitor_datasource';
import AzureLogAnalyticsDatasource from './azure_log_analytics/azure_log_analytics_datasource';
import { InsightsConfig } from './components/InsightsConfig';

type Props = DataSourcePluginOptionsEditorProps<any>;

export interface State {
  config: any;
  subscriptions: SelectableValue[];
  logAnalyticsSubscriptions: SelectableValue[];
  logAnalyticsWorkspaces: SelectableValue[];
}

export class ConfigEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { options } = this.props;

    this.state = {
      config: ConfigEditor.keyFill(options),
      subscriptions: [],
      logAnalyticsSubscriptions: [],
      logAnalyticsWorkspaces: [],
    };

    this.backendSrv = getBackendSrv();
    this.templateSrv = new TemplateSrv();

    if (options.id) {
      this.state.config.url = '/api/datasources/proxy/' + options.id;
      this.init();
    }

    this.props.onOptionsChange(this.state.config);
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    return {
      ...state,
      config: ConfigEditor.keyFill(props.options),
    };
  }

  static keyFill = options => {
    options.jsonData.cloudName = options.jsonData.cloudName || 'azuremonitor';
    options.jsonData.tenantId = options.jsonData.tenantId || '';
    options.jsonData.clientId = options.jsonData.clientId || '';
    options.jsonData.logAnalyticsTenantId = options.jsonData.logAnalyticsTenantId || '';
    options.jsonData.logAnalyticsClientId = options.jsonData.logAnalyticsClientId || '';
    options.jsonData.appInsightsAppId = options.jsonData.appInsightsAppId || '';

    if (!options.jsonData.hasOwnProperty('azureLogAnalyticsSameAs')) {
      options.jsonData.azureLogAnalyticsSameAs = true;
    }

    if (!options.jsonData.hasOwnProperty('subscriptionId')) {
      options.jsonData.subscriptionId = '';
    }

    if (!options.hasOwnProperty('secureJsonData')) {
      options.secureJsonData = {};
    }

    if (!options.secureJsonData.hasOwnProperty('clientSecret')) {
      options.secureJsonData.clientSecret = '';
    }

    if (!options.secureJsonData.hasOwnProperty('logAnalyticsClientSecret')) {
      options.secureJsonData.logAnalyticsClientSecret = '';
    }

    if (!options.secureJsonData.hasOwnProperty('appInsightsApiKey')) {
      options.secureJsonData.appInsightsApiKey = '';
    }

    if (!options.hasOwnProperty('secureJsonFields')) {
      options.secureJsonFields = {
        clientSecret: false,
        logAnalyticsClientSecret: false,
        appInsightsApiKey: false,
      };
    }

    return options;
  };

  backendSrv: BackendSrv = null;
  templateSrv: TemplateSrv = null;

  init = async () => {
    await this.getSubscriptions();

    if (!this.state.config.jsonData.azureLogAnalyticsSameAs) {
      await this.getLogAnalyticsSubscriptions();
    }
  };

  hasNecessaryCredentials = () => {
    if (!this.state.config.secureJsonFields.clientSecret && !this.state.config.secureJsonData.clientSecret) {
      return false;
    }

    if (!this.state.config.jsonData.clientId || !this.state.config.jsonData.tenantId) {
      return false;
    }

    return true;
  };

  logAnalyticsHasNecessaryCredentials = () => {
    if (
      !this.state.config.secureJsonFields.logAnalyticsClientSecret &&
      !this.state.config.secureJsonData.logAnalyticsClientSecret
    ) {
      return false;
    }

    if (!this.state.config.jsonData.logAnalyticsClientId || !this.state.config.jsonData.logAnalyticsTenantId) {
      return false;
    }

    return true;
  };

  onConfigUpdate = config => {
    this.props.onOptionsChange(config);
  };

  onLoadSubscriptions = async (type?: string) => {
    await this.backendSrv.put(`/api/datasources/${this.state.config.id}`, this.state.config).then(() => {
      this.props.onOptionsChange({
        ...this.state.config,
        version: this.state.config.version + 1,
      });
    });

    if (type && type === 'workspacesloganalytics') {
      this.getLogAnalyticsSubscriptions();
    } else {
      this.getSubscriptions();
    }
  };

  getSubscriptions = async () => {
    if (!this.hasNecessaryCredentials()) {
      return;
    }

    const azureMonitorDatasource = new AzureMonitorDatasource(this.state.config, this.backendSrv, this.templateSrv);

    let subscriptions = (await azureMonitorDatasource.getSubscriptions()) || [];
    subscriptions = subscriptions.map(subscription => {
      return {
        value: subscription.value,
        label: subscription.text,
      };
    });

    if (subscriptions && subscriptions.length > 0) {
      this.setState({ subscriptions });

      this.props.onOptionsChange({
        ...this.state.config,
        jsonData: {
          ...this.state.config.jsonData,
          subscriptionId: this.state.config.jsonData.subscriptionId || subscriptions[0].value,
        },
      });
    }

    if (this.state.config.jsonData.subscriptionId && this.state.config.jsonData.azureLogAnalyticsSameAs) {
      await this.getWorkspaces();
    }
  };

  getLogAnalyticsSubscriptions = async () => {
    if (!this.logAnalyticsHasNecessaryCredentials()) {
      return;
    }

    const azureMonitorDatasource = new AzureMonitorDatasource(this.state.config, this.backendSrv, this.templateSrv);

    let logAnalyticsSubscriptions = (await azureMonitorDatasource.getSubscriptions('workspacesloganalytics')) || [];
    logAnalyticsSubscriptions = logAnalyticsSubscriptions.map(subscription => {
      return {
        value: subscription.value,
        label: subscription.text,
      };
    });

    if (logAnalyticsSubscriptions && logAnalyticsSubscriptions.length > 0) {
      this.setState({ logAnalyticsSubscriptions });

      this.props.onOptionsChange({
        ...this.state.config,
        jsonData: {
          ...this.state.config.jsonData,
          logAnalyticsSubscriptionId:
            this.state.config.jsonData.logAnalyticsSubscriptionId || logAnalyticsSubscriptions[0].value,
        },
      });
    }

    if (this.state.config.jsonData.logAnalyticsSubscriptionId) {
      await this.getWorkspaces();
    }
  };

  getWorkspaces = async () => {
    const sameAs = this.state.config.jsonData.azureLogAnalyticsSameAs && this.state.config.jsonData.subscriptionId;
    if (!sameAs && !this.state.config.jsonData.logAnalyticsSubscriptionId) {
      return;
    }

    const azureLogAnalyticsDatasource = new AzureLogAnalyticsDatasource(
      this.state.config,
      this.backendSrv,
      this.templateSrv
    );

    let logAnalyticsWorkspaces = await azureLogAnalyticsDatasource.getWorkspaces(
      sameAs ? this.state.config.jsonData.subscriptionId : this.state.config.jsonData.logAnalyticsSubscriptionId
    );
    logAnalyticsWorkspaces = logAnalyticsWorkspaces.map(workspace => {
      return {
        value: workspace.value,
        label: workspace.text,
      };
    });

    if (logAnalyticsWorkspaces.length > 0) {
      this.state.config.jsonData.logAnalyticsDefaultWorkspace =
        this.state.config.jsonData.logAnalyticsDefaultWorkspace || logAnalyticsWorkspaces[0].value;

      this.setState({ logAnalyticsWorkspaces });
    }
  };

  render() {
    const { config, subscriptions, logAnalyticsSubscriptions, logAnalyticsWorkspaces } = this.state;

    return (
      <>
        <MonitorConfig
          datasourceConfig={config}
          subscriptions={subscriptions}
          onLoadSubscriptions={this.onLoadSubscriptions}
          onDatasourceUpdate={this.onConfigUpdate}
        />

        <AnalyticsConfig
          datasourceConfig={config}
          logAnalyticsWorkspaces={logAnalyticsWorkspaces}
          logAnalyticsSubscriptions={logAnalyticsSubscriptions}
          onLoadSubscriptions={this.onLoadSubscriptions}
          onDatasourceUpdate={this.onConfigUpdate}
        />

        <InsightsConfig datasourceConfig={config} onDatasourceUpdate={this.onConfigUpdate} />
      </>
    );
  }
}
