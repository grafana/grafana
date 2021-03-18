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
import { getBackendSrv, TemplateSrv, getTemplateSrv } from '@grafana/runtime';
import { InsightsConfig } from './InsightsConfig';
import ResponseParser from '../azure_monitor/response_parser';
import { AzureDataSourceJsonData, AzureDataSourceSecureJsonData, AzureDataSourceSettings } from '../types';
import { makePromiseCancelable, CancelablePromise } from 'app/core/utils/CancelablePromise';
import AnalyticsResourceConfig from './AnalyticsResourceConfig';

export type Props = DataSourcePluginOptionsEditorProps<AzureDataSourceJsonData, AzureDataSourceSecureJsonData>;

export interface State {
  subscriptions: SelectableValue[];
  logAnalyticsSubscriptions: SelectableValue[];
  resourceLogAnalyticsSubscriptions: SelectableValue[];
  logAnalyticsWorkspaces: SelectableValue[];
  logAnalyticsResources: SelectableValue[];
  subscriptionId: string;
  logAnalyticsSubscriptionId: string;
  resourceLogAnalyticsSubscriptionId: string;
}

export class ConfigEditor extends PureComponent<Props, State> {
  initPromise: CancelablePromise<any> | null = null;
  templateSrv: TemplateSrv = getTemplateSrv();

  constructor(props: Props) {
    super(props);

    this.state = {
      subscriptions: [],
      logAnalyticsSubscriptions: [],
      resourceLogAnalyticsSubscriptions: [],
      logAnalyticsWorkspaces: [],
      logAnalyticsResources: [],
      subscriptionId: '',
      logAnalyticsSubscriptionId: '',
      resourceLogAnalyticsSubscriptionId: '',
    };

    if (this.props.options.id) {
      updateDatasourcePluginOption(this.props, 'url', '/api/datasources/proxy/' + this.props.options.id);
    }
  }

  componentDidMount() {
    this.initPromise = makePromiseCancelable(this.init());
    this.initPromise.promise.catch(({ isCanceled }) => {
      if (isCanceled) {
        console.warn('Azure Monitor ConfigEditor has unmounted, intialization was canceled');
      }
    });
  }

  componentWillUnmount() {
    this.initPromise!.cancel();
  }

  init = async () => {
    await this.getSubscriptions();

    if (!this.props.options.jsonData.azureLogAnalyticsSameAs) {
      await this.getLogAnalyticsSubscriptions();
    }

    if (!this.props.options.jsonData.azureResourceLogAnalyticsSameAs) {
      await this.getResourceLogAnalyticsSubscriptions();
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
    const clientSecret = updatedClientSecret || options.secureJsonData!.clientSecret;

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
    if (!this.props.options.secureJsonFields.clientSecret && !this.props.options.secureJsonData!.clientSecret) {
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
      !this.props.options.secureJsonData!.logAnalyticsClientSecret
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

    if (azureLogAnalyticsSameAs) {
      const azureCloud = cloudName || 'azuremonitor';
      azureMonitorUrl = `/${azureCloud}/subscriptions`;
    } else {
      subscriptionId = logAnalyticsSubscriptionId!;
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

  loadResources = async (subscription: string) => {
    const { cloudName } = this.props.options.jsonData;

    const subscriptionId = this.templateSrv.replace(subscription || this.props.options.jsonData.subscriptionId);
    const azureCloud = cloudName || 'azuremonitor';

    const result = await getBackendSrv().datasourceRequest({
      url: `${this.props.options.url}/${azureCloud}/providers/Microsoft.ResourceGraph/resources?api-version=2019-04-01`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: { subscriptions: [subscriptionId], query: 'project id, name' },
    });

    return result.data.data.rows.map((row: number[]) => ({ label: row[1], value: row[0] }));
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

    if (this.props.options.jsonData.subscriptionId && this.props.options.jsonData.azureResourceLogAnalyticsSameAs) {
      await this.getResources();
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

  getResourceLogAnalyticsSubscriptions = async () => {
    if (!this.logAnalyticsHasNecessaryCredentials()) {
      return;
    }

    const resourceLogAnalyticsSubscriptions = ((await this.loadSubscriptions('workspacesloganalytics')) ||
      []) as SelectableValue[];

    if (resourceLogAnalyticsSubscriptions && resourceLogAnalyticsSubscriptions.length > 0) {
      this.setState({ resourceLogAnalyticsSubscriptions });

      this.updateJsonDataOption(
        'resourceLogAnalyticsSubscriptionId',
        this.props.options.jsonData.resourceLogAnalyticsSubscriptionId || resourceLogAnalyticsSubscriptions[0].value
      );
    }

    if (this.props.options.jsonData.logAnalyticsSubscriptionId) {
      await this.getResources();
    }
  };

  getWorkspaces = async () => {
    const { subscriptionId, azureLogAnalyticsSameAs, logAnalyticsSubscriptionId } = this.props.options.jsonData;
    const subscriptionIdToUse = azureLogAnalyticsSameAs ? subscriptionId : logAnalyticsSubscriptionId;

    if (!subscriptionIdToUse) {
      return;
    }

    const logAnalyticsWorkspaces = await this.loadWorkspaces(subscriptionIdToUse);

    if (logAnalyticsWorkspaces.length > 0) {
      this.setState({ logAnalyticsWorkspaces });

      this.updateJsonDataOption(
        'logAnalyticsDefaultWorkspace',
        this.props.options.jsonData.logAnalyticsDefaultWorkspace || logAnalyticsWorkspaces[0].value
      );
    }
  };

  getResources = async () => {
    const { subscriptionId, azureLogAnalyticsSameAs, logAnalyticsSubscriptionId } = this.props.options.jsonData;
    const subscriptionIdToUse = azureLogAnalyticsSameAs ? subscriptionId : logAnalyticsSubscriptionId;

    if (!subscriptionIdToUse) {
      return;
    }

    const logAnalyticsResources = await this.loadResources(subscriptionIdToUse);

    if (logAnalyticsResources.length > 0) {
      this.setState({ logAnalyticsResources });

      this.updateJsonDataOption('logAnalyticsDefaultResource', logAnalyticsResources[0].value);
    }
  };

  render() {
    const {
      subscriptions,
      logAnalyticsSubscriptions,
      resourceLogAnalyticsSubscriptions,
      logAnalyticsWorkspaces,
      logAnalyticsResources,
    } = this.state;
    const { options } = this.props;

    options.jsonData.cloudName = options.jsonData.cloudName || 'azuremonitor';
    // This is bad, causes so many messy typing issues everwhere..
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

        <AnalyticsResourceConfig
          options={options}
          resources={logAnalyticsResources}
          subscriptions={resourceLogAnalyticsSubscriptions}
          makeSameAs={this.makeSameAs}
          onUpdateDatasourceOptions={this.props.onOptionsChange}
          onUpdateJsonDataOption={this.updateJsonDataOption}
          onUpdateSecureJsonDataOption={this.updateSecureJsonDataOption}
          onResetOptionKey={this.resetSecureKey}
          onLoadSubscriptions={this.onLoadSubscriptions}
          onLoadResources={this.getResources}
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
