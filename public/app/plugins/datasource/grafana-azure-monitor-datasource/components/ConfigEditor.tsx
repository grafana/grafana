import React, { PureComponent } from 'react';
import {
  SelectableValue,
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginOption,
  updateDatasourcePluginResetKeyOption,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { MonitorConfig } from './MonitorConfig';
import { AnalyticsConfig } from './AnalyticsConfig';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { getBackendSrv, BackendSrv } from 'app/core/services/backend_srv';
import { InsightsConfig } from './InsightsConfig';
import ResponseParser from '../azure_monitor/response_parser';
import { AzureDataSourceJsonData, AzureDataSourceSecureJsonData, AzureDataSourceSettings } from '../types';
import { makePromiseCancelable, CancelablePromise } from 'app/core/utils/CancelablePromise';

export type Props = DataSourcePluginOptionsEditorProps<AzureDataSourceJsonData, AzureDataSourceSecureJsonData>;

export interface State {
  subscriptions: SelectableValue[];
  logAnalyticsSubscriptions: SelectableValue[];
  logAnalyticsWorkspaces: SelectableValue[];
  subscriptionId: string;
  logAnalyticsSubscriptionId: string;
}

export class ConfigEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      subscriptions: [],
      logAnalyticsSubscriptions: [],
      logAnalyticsWorkspaces: [],
      subscriptionId: '',
      logAnalyticsSubscriptionId: '',
    };

    this.backendSrv = getBackendSrv();
    this.templateSrv = new TemplateSrv();
    if (this.props.options.id) {
      updateDatasourcePluginOption(this.props, 'url', '/api/datasources/proxy/' + this.props.options.id);
    }
  }

  initPromise: CancelablePromise<any> = null;
  backendSrv: BackendSrv = null;
  templateSrv: TemplateSrv = null;

  componentDidMount() {
    this.initPromise = makePromiseCancelable(this.init());
    this.initPromise.promise.catch(({ isCanceled }) => {
      if (isCanceled) {
        console.warn('Azure Monitor ConfigEditor has unmounted, intialization was canceled');
      }
    });
  }

  componentWillUnmount() {
    this.initPromise.cancel();
  }

  init = async () => {
    await this.getSubscriptions();

    if (!this.props.options.jsonData.azureLogAnalyticsSameAs) {
      await this.getLogAnalyticsSubscriptions();
    }
  };

  updateOption = (key: string, val: any, secure: boolean) => {
    updateDatasourcePluginJsonDataOption(this.props, key, val, secure);
  };

  resetKey = (key: string) => {
    updateDatasourcePluginResetKeyOption(this.props, key);
  };

  makeSameAs = (updatedClientSecret?: string) => {
    const { options } = this.props;
    const clientSecret = updatedClientSecret || options.secureJsonData.clientSecret;

    this.updateOptions({
      ...options,
      jsonData: {
        ...options.jsonData,
        azureLogAnalyticsSameAs: true,
        logAnalyticsSubscriptionId: options.jsonData.subscriptionId,
        logAnalyticsTenantId: options.jsonData.tenantId,
        logAnalyticsClientId: options.jsonData.clientId,
      },
      secureJsonData: {
        ...options.secureJsonData,
        clientSecret,
        logAnalyticsClientSecret: clientSecret,
      },
    });
  };

  updateOptions = (options: AzureDataSourceSettings) => {
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
    await this.backendSrv
      .put(`/api/datasources/${this.props.options.id}`, this.props.options)
      .then((result: AzureDataSourceSettings) => {
        updateDatasourcePluginOption(this.props, 'version', result.version);
      });

    if (type && type === 'workspacesloganalytics') {
      this.getLogAnalyticsSubscriptions();
    } else {
      this.getSubscriptions();
    }
  };

  loadSubscriptions = async (route?: string) => {
    const url = `/${route || this.props.options.jsonData.cloudName}/subscriptions?api-version=2019-03-01`;

    const result = await this.backendSrv.datasourceRequest({
      url: this.props.options.url + url,
      method: 'GET',
    });

    return ResponseParser.parseSubscriptionsForSelect(result);
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

    const result = await this.backendSrv.datasourceRequest({
      url: this.props.options.url + workspaceListUrl,
      method: 'GET',
    });

    return ResponseParser.parseWorkspacesForSelect(result);
  };

  getSubscriptions = async () => {
    if (!this.hasNecessaryCredentials()) {
      return;
    }

    const subscriptions = ((await this.loadSubscriptions()) || []) as SelectableValue[];

    if (subscriptions && subscriptions.length > 0) {
      this.setState({ subscriptions });

      this.updateOption('subscriptionId', this.props.options.jsonData.subscriptionId || subscriptions[0].value, false);
    }

    if (this.props.options.jsonData.subscriptionId && this.props.options.jsonData.azureLogAnalyticsSameAs) {
      await this.getWorkspaces();
    }
  };

  getLogAnalyticsSubscriptions = async () => {
    if (!this.logAnalyticsHasNecessaryCredentials()) {
      return;
    }

    const logAnalyticsSubscriptions = ((await this.loadSubscriptions('workspacesloganalytics')) ||
      []) as SelectableValue[];

    if (logAnalyticsSubscriptions && logAnalyticsSubscriptions.length > 0) {
      this.setState({ logAnalyticsSubscriptions });

      this.updateOption(
        'logAnalyticsSubscriptionId',
        this.props.options.jsonData.logAnalyticsSubscriptionId || logAnalyticsSubscriptions[0].value,
        false
      );
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

      this.updateOption(
        'logAnalyticsDefaultWorkspace',
        this.props.options.jsonData.logAnalyticsDefaultWorkspace || logAnalyticsWorkspaces[0].value,
        false
      );
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
          makeSameAs={this.makeSameAs}
          onLoadSubscriptions={this.onLoadSubscriptions}
          onUpdateOption={this.updateOption}
          onResetOptionKey={this.resetKey}
        />

        <AnalyticsConfig
          options={options}
          workspaces={logAnalyticsWorkspaces}
          subscriptions={logAnalyticsSubscriptions}
          makeSameAs={this.makeSameAs}
          onUpdateOptions={this.updateOptions}
          onUpdateOption={this.updateOption}
          onResetOptionKey={this.resetKey}
          onLoadSubscriptions={this.onLoadSubscriptions}
          onLoadWorkspaces={this.getWorkspaces}
        />

        <InsightsConfig options={options} onUpdateOption={this.updateOption} onResetOptionKey={this.resetKey} />
      </>
    );
  }
}

export default ConfigEditor;
