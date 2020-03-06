import React, { PureComponent } from 'react';
import {
  SelectableValue,
  DataSourcePluginOptionsEditorProps,
  updateDatasourcePluginOption,
  updateDatasourcePluginResetOption,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginSecureJsonDataOption,
} from '@grafana/data';
import { MonitorConfig } from './MonitorConfig';
import { AnalyticsConfig } from './AnalyticsConfig';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { getBackendSrv } from '@grafana/runtime';
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

    this.templateSrv = new TemplateSrv();
    if (this.props.options.id) {
      updateDatasourcePluginOption(this.props, 'url', '/api/datasources/proxy/' + this.props.options.id);
    }
  }

  initPromise: CancelablePromise<any> = null;
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

  updateJsonDataOption = (key: keyof AzureDataSourceJsonData, val: any) => {
    updateDatasourcePluginJsonDataOption(this.props, key, val);
  };

  updateSecureJsonDataOption = (key: keyof AzureDataSourceSecureJsonData, val: any) => {
    updateDatasourcePluginSecureJsonDataOption(this.props, key, val);
  };

  resetSecureKey = (key: keyof AzureDataSourceSecureJsonData) => {
    updateDatasourcePluginResetOption(this.props, key);
  };

  onUpdateJsonDataOption = (key: keyof AzureDataSourceJsonData) => (
    event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    this.updateJsonDataOption(key, event.currentTarget.value);
  };

  onUpdateSecureJsonDataOption = (key: keyof AzureDataSourceSecureJsonData) => (
    event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    this.updateSecureJsonDataOption(key, event.currentTarget.value);
  };

  makeSameAs = (updatedClientSecret?: string) => {
    const { options } = this.props;
    const clientSecret = updatedClientSecret || options.secureJsonData.clientSecret;

    this.props.onOptionsChange({
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
    await getBackendSrv()
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

    const result = await getBackendSrv().datasourceRequest({
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

    const result = await getBackendSrv().datasourceRequest({
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

      this.updateJsonDataOption('subscriptionId', this.props.options.jsonData.subscriptionId || subscriptions[0].value);
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

      this.updateJsonDataOption(
        'logAnalyticsSubscriptionId',
        this.props.options.jsonData.logAnalyticsSubscriptionId || logAnalyticsSubscriptions[0].value
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

      this.updateJsonDataOption(
        'logAnalyticsDefaultWorkspace',
        this.props.options.jsonData.logAnalyticsDefaultWorkspace || logAnalyticsWorkspaces[0].value
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
          onUpdateJsonDataOption={this.updateJsonDataOption}
          onUpdateSecureJsonDataOption={this.updateSecureJsonDataOption}
          onResetOptionKey={this.resetSecureKey}
        />

        <AnalyticsConfig
          options={options}
          workspaces={logAnalyticsWorkspaces}
          subscriptions={logAnalyticsSubscriptions}
          makeSameAs={this.makeSameAs}
          onUpdateDatasourceOptions={this.props.onOptionsChange}
          onUpdateJsonDataOption={this.updateJsonDataOption}
          onUpdateSecureJsonDataOption={this.updateSecureJsonDataOption}
          onResetOptionKey={this.resetSecureKey}
          onLoadSubscriptions={this.onLoadSubscriptions}
          onLoadWorkspaces={this.getWorkspaces}
        />

        <InsightsConfig
          options={options}
          onUpdateJsonDataOption={this.onUpdateJsonDataOption}
          onUpdateSecureJsonDataOption={this.onUpdateSecureJsonDataOption}
          onResetOptionKey={this.resetSecureKey}
        />
      </>
    );
  }
}

export default ConfigEditor;
