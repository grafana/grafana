import AzureLogAnalyticsDatasource from './azure_log_analytics/azure_log_analytics_datasource';
import config from 'app/core/config';
import { isVersionGtOrEq } from 'app/core/utils/version';
import AzureMonitorDatasource from './azure_monitor/azure_monitor_datasource';

interface AzureCloud {
  key: string;
  url: string;
  loginUrl: string;
}

export class AzureMonitorConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/grafana-azure-monitor-datasource/partials/config.html';
  current: any;
  azureLogAnalyticsDatasource: any;
  azureMonitorDatasource: any;
  workspaces: any[];
  subscriptions: Array<{ text: string; value: string }>;
  subscriptionsForLogAnalytics: Array<{ text: string; value: string }>;
  hasRequiredGrafanaVersion: boolean;
  azureClouds: AzureCloud[];
  token: string;

  /** @ngInject */
  constructor(private backendSrv, private $q, private templateSrv) {
    this.hasRequiredGrafanaVersion = this.hasMinVersion();
    this.current.jsonData.cloudName = this.current.jsonData.cloudName || 'azuremonitor';
    this.current.jsonData.azureLogAnalyticsSameAs = this.current.jsonData.azureLogAnalyticsSameAs || false;
    this.current.secureJsonData = this.current.secureJsonData || {};
    this.current.secureJsonFields = this.current.secureJsonFields || {};
    this.subscriptions = [];
    this.subscriptionsForLogAnalytics = [];
    this.azureClouds = [
      {
        key: 'azuremonitor',
        url: 'https://management.azure.com/',
        loginUrl: 'https://login.microsoftonline.com/',
      },
      {
        key: 'govazuremonitor',
        url: 'https://management.usgovcloudapi.net/',
        loginUrl: 'https://login.microsoftonline.us/',
      },
      {
        key: 'germanyazuremonitor',
        url: 'https://management.microsoftazure.de',
        loginUrl: 'https://management.microsoftazure.de/',
      },
      {
        key: 'chinaazuremonitor',
        url: 'https://management.chinacloudapi.cn',
        loginUrl: 'https://login.chinacloudapi.cn',
      },
    ];

    if (this.current.id) {
      this.current.url = '/api/datasources/proxy/' + this.current.id;
      this.init();
    }
  }

  async init() {
    this.azureMonitorDatasource = new AzureMonitorDatasource(this.current, this.backendSrv, this.templateSrv);
    await this.getSubscriptions();
    await this.getSubscriptionsForLogsAnalytics();

    this.azureLogAnalyticsDatasource = new AzureLogAnalyticsDatasource(
      this.current,
      this.backendSrv,
      this.templateSrv,
      this.$q
    );
    await this.getWorkspaces();
  }

  hasMinVersion(): boolean {
    return isVersionGtOrEq(config.buildInfo.version, '5.2');
  }

  showMinVersionWarning() {
    return !this.hasRequiredGrafanaVersion && this.current.secureJsonFields.logAnalyticsClientSecret;
  }

  async getWorkspaces() {
    const sameAs = this.current.jsonData.azureLogAnalyticsSameAs && this.subscriptions.length > 0;
    if (!sameAs && this.subscriptionsForLogAnalytics.length === 0) {
      return;
    }

    this.workspaces = await this.azureLogAnalyticsDatasource.getWorkspaces();
    if (this.workspaces.length > 0) {
      this.current.jsonData.logAnalyticsDefaultWorkspace =
        this.current.jsonData.logAnalyticsDefaultWorkspace || this.workspaces[0].value;
    }
  }

  async getSubscriptions() {
    if (!this.current.secureJsonFields.clientSecret && !this.current.secureJsonData.clientSecret) {
      return;
    }

    this.subscriptions = (await this.azureMonitorDatasource.getSubscriptions()) || [];
    if (this.subscriptions && this.subscriptions.length > 0) {
      this.current.jsonData.subscriptionId = this.current.jsonData.subscriptionId || this.subscriptions[0].value;
    }
  }

  async getSubscriptionsForLogsAnalytics() {
    if (
      !this.current.secureJsonFields.logAnalyticsClientSecret &&
      !this.current.secureJsonData.logAnalyticsClientSecret
    ) {
      return;
    }

    this.subscriptionsForLogAnalytics =
      (await this.azureMonitorDatasource.getSubscriptions('workspacesloganalytics')) || [];

    if (this.subscriptionsForLogAnalytics && this.subscriptionsForLogAnalytics.length > 0) {
      this.current.jsonData.logAnalyticsSubscriptionId =
        this.current.jsonData.logAnalyticsSubscriptionId || this.subscriptionsForLogAnalytics[0].value;
    }
  }
}
