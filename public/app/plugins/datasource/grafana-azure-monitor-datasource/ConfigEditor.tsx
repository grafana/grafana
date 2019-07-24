// Libraries
import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { DataSourcePluginOptionsEditorProps } from '@grafana/ui';
import { MonitorConfig } from './components/MonitorConfig';
import { AnalyticsConfig } from './components/AnalyticsConfig';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { getBackendSrv, BackendSrv } from 'app/core/services/backend_srv';
import AzureMonitorDatasource from './azure_monitor/azure_monitor_datasource';
import AzureLogAnalyticsDatasource from './azure_log_analytics/azure_log_analytics_datasource';

type Props = DataSourcePluginOptionsEditorProps<any>;

export interface State {
  config: any;
  subscriptions: SelectableValue[];
  logAnalyticsSubscriptions: SelectableValue[];
  workspaces: SelectableValue[];
}

export class ConfigEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { options } = this.props;
    console.log('init', options);

    this.state = {
      config: ConfigEditor.keyFill(options),
      subscriptions: [],
      logAnalyticsSubscriptions: [],
      workspaces: [],
    };

    this.backendSrv = getBackendSrv();
    this.tplSrv = new TemplateSrv();

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

    if (!options.id) {
      options.jsonData.azureLogAnalyticsSameAs = true;
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

    if (!options.hasOwnProperty('secureJsonFields')) {
      options.secureJsonFields = {
        clientSecret: false,
        logAnalyticsClientSecret: false,
      };
    }

    return options;
  };

  //todo type
  backendSrv: BackendSrv = null;
  tplSrv: TemplateSrv = null;

  init = async () => {
    await this.getSubscriptions();

    if (!this.state.config.jsonData.azureLogAnalyticsSameAs) {
      await this.getLogAnalyticsSubscriptions();
    }

    await this.getWorkspaces();
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

      if (type && type === 'workspacesloganalytics') {
        this.getLogAnalyticsSubscriptions();
      } else {
        this.getSubscriptions();
      }
    });
  };

  getSubscriptions = async () => {
    if (!this.hasNecessaryCredentials()) {
      return;
    }

    const azureMonitorDatasource = new AzureMonitorDatasource(this.state.config, this.backendSrv, this.tplSrv);

    let subscriptions = (await azureMonitorDatasource.getSubscriptions()) || [];
    subscriptions = subscriptions.map(subscription => {
      return {
        value: subscription.value,
        label: subscription.text,
      };
    });

    if (subscriptions && subscriptions.length > 0) {
      this.props.onOptionsChange({
        ...this.state.config,
        jsonData: {
          ...this.state.config.jsonData,
          subscriptionId: this.state.config.jsonData.subscriptionId || subscriptions[0].value,
        },
      });

      this.setState({
        subscriptions,
      });
    }
  };

  getLogAnalyticsSubscriptions = async () => {
    if (!this.logAnalyticsHasNecessaryCredentials()) {
      return;
    }

    const azureMonitorDatasource = new AzureMonitorDatasource(this.state.config, this.backendSrv, this.tplSrv);

    let logAnalyticsSubscriptions = (await azureMonitorDatasource.getSubscriptions('workspacesloganalytics')) || [];
    logAnalyticsSubscriptions = logAnalyticsSubscriptions.map(subscription => {
      return {
        value: subscription.value,
        label: subscription.text,
      };
    });

    if (logAnalyticsSubscriptions && logAnalyticsSubscriptions.length > 0) {
      this.props.onOptionsChange({
        ...this.state.config,
        jsonData: {
          ...this.state.config.jsonData,
          logAnalyticsSubscriptionId:
            this.state.config.jsonData.logAnalyticsSubscriptionId || logAnalyticsSubscriptions[0].value,
        },
      });
      this.setState({
        logAnalyticsSubscriptions,
      });
    }
  };

  getWorkspaces = async () => {
    console.log('lets get em');
    // const sameAs = this.state.config.jsonData.azureLogAnalyticsSameAs && this.state.subscriptions.length > 0;
    // if (!sameAs && this.state.logAnalyticsSubscriptions.length === 0) {
    //   return;
    // }

    const azureLogAnalyticsDatasource = new AzureLogAnalyticsDatasource(
      this.state.config,
      this.backendSrv,
      this.tplSrv
    );

    const workspaces = await azureLogAnalyticsDatasource.getWorkspaces(
      this.state.config.jsonData.logAnalyticsSubscriptionId
    );
    if (workspaces.length > 0) {
      this.state.config.jsonData.logAnalyticsDefaultWorkspace =
        this.state.config.jsonData.logAnalyticsDefaultWorkspace || workspaces[0].value;
      this.setState({
        workspaces,
      });
    }
  };

  render() {
    const { config, subscriptions, logAnalyticsSubscriptions } = this.state;
    console.log(config);
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
          logAnalyticsSubscriptions={
            config.jsonData.azureLogAnalyticsSameAs ? subscriptions : logAnalyticsSubscriptions
          }
          onLoadSubscriptions={this.onLoadSubscriptions}
          onDatasourceUpdate={this.onConfigUpdate}
        />
      </>
    );
  }
}
