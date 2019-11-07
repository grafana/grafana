import React, { PureComponent } from 'react';
import { SelectableValue, DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { MonitorConfig } from './components/MonitorConfig';
import { AnalyticsConfig } from './components/AnalyticsConfig';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { getBackendSrv, BackendSrv } from 'app/core/services/backend_srv';
import AzureMonitorDatasource from './azure_monitor/azure_monitor_datasource';
import AzureLogAnalyticsDatasource from './azure_log_analytics/azure_log_analytics_datasource';
import { InsightsConfig } from './components/InsightsConfig';

export type Props = DataSourcePluginOptionsEditorProps<any>;

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
      config: ConfigEditor.defaults(options),
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

    this.updateDatasource(this.state.config);
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    return {
      ...state,
      config: ConfigEditor.defaults(props.options),
    };
  }

  static defaults = (options: any) => {
    options.jsonData.cloudName = options.jsonData.cloudName || 'azuremonitor';

    if (!options.jsonData.hasOwnProperty('azureLogAnalyticsSameAs')) {
      options.jsonData.azureLogAnalyticsSameAs = true;
    }

    if (!options.hasOwnProperty('secureJsonData')) {
      options.secureJsonData = {};
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

  updateDatasource = async (config: any) => {
    for (const j in config.jsonData) {
      if (config.jsonData[j].length === 0) {
        delete config.jsonData[j];
      }
    }

    for (const k in config.secureJsonData) {
      if (config.secureJsonData[k].length === 0) {
        delete config.secureJsonData[k];
      }
    }

    this.props.onOptionsChange({
      ...config,
    });
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

  onConfigUpdate = (config: any) => {
    this.updateDatasource(config);
  };

  onLoadSubscriptions = async (type?: string) => {
    await this.backendSrv.put(`/api/datasources/${this.state.config.id}`, this.state.config).then(() => {
      this.updateDatasource({
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
    subscriptions = subscriptions.map((subscription: any) => {
      return {
        value: subscription.value,
        label: subscription.text,
      };
    });

    if (subscriptions && subscriptions.length > 0) {
      this.setState({ subscriptions });

      this.state.config.jsonData.subscriptionId = this.state.config.jsonData.subscriptionId || subscriptions[0].value;
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
    logAnalyticsSubscriptions = logAnalyticsSubscriptions.map((subscription: any) => {
      return {
        value: subscription.value,
        label: subscription.text,
      };
    });

    if (logAnalyticsSubscriptions && logAnalyticsSubscriptions.length > 0) {
      this.setState({ logAnalyticsSubscriptions });

      this.state.config.jsonData.logAnalyticsSubscriptionId =
        this.state.config.jsonData.logAnalyticsSubscriptionId || logAnalyticsSubscriptions[0].value;
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
    logAnalyticsWorkspaces = logAnalyticsWorkspaces.map((workspace: any) => {
      return {
        value: workspace.value,
        label: workspace.text,
      };
    });

    if (logAnalyticsWorkspaces.length > 0) {
      this.setState({ logAnalyticsWorkspaces });

      this.state.config.jsonData.logAnalyticsDefaultWorkspace =
        this.state.config.jsonData.logAnalyticsDefaultWorkspace || logAnalyticsWorkspaces[0].value;
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
          onLoadWorkspaces={this.getWorkspaces}
        />

        <InsightsConfig datasourceConfig={config} onDatasourceUpdate={this.onConfigUpdate} />
      </>
    );
  }
}

export default ConfigEditor;
