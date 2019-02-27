import AzureLogAnalyticsDatasource from './azure_log_analytics/azure_log_analytics_datasource';
import config from 'app/core/config';
import { isVersionGtOrEq } from 'app/core/utils/version';

export class AzureMonitorConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/grafana-azure-monitor-datasource/partials/config.html';
  current: any;
  azureLogAnalyticsDatasource: any;
  workspaces: any[];
  hasRequiredGrafanaVersion: boolean;

  /** @ngInject */
  constructor($scope, backendSrv, $q) {
    this.hasRequiredGrafanaVersion = this.hasMinVersion();
    this.current.jsonData.cloudName = this.current.jsonData.cloudName || 'azuremonitor';
    this.current.jsonData.azureLogAnalyticsSameAs = this.current.jsonData.azureLogAnalyticsSameAs || false;

    if (this.current.id) {
      this.current.url = '/api/datasources/proxy/' + this.current.id;
      this.azureLogAnalyticsDatasource = new AzureLogAnalyticsDatasource(this.current, backendSrv, null, $q);
      this.getWorkspaces();
    }
  }

  hasMinVersion(): boolean {
    return isVersionGtOrEq(config.buildInfo.version, '5.2');
  }

  showMinVersionWarning() {
    return !this.hasRequiredGrafanaVersion && this.current.secureJsonFields.logAnalyticsClientSecret;
  }

  getWorkspaces() {
    if (!this.azureLogAnalyticsDatasource.isConfigured()) {
      return;
    }

    return this.azureLogAnalyticsDatasource.getWorkspaces().then(workspaces => {
      this.workspaces = workspaces;
      if (this.workspaces.length > 0) {
        this.current.jsonData.logAnalyticsDefaultWorkspace =
          this.current.jsonData.logAnalyticsDefaultWorkspace || this.workspaces[0].value;
      }
    });
  }
}
