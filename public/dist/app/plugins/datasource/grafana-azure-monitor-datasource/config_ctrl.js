import AzureLogAnalyticsDatasource from './azure_log_analytics/azure_log_analytics_datasource';
import config from 'app/core/config';
import { isVersionGtOrEq } from 'app/core/utils/version';
var AzureMonitorConfigCtrl = /** @class */ (function () {
    /** @ngInject */
    function AzureMonitorConfigCtrl($scope, backendSrv, $q) {
        this.hasRequiredGrafanaVersion = this.hasMinVersion();
        this.current.jsonData.cloudName = this.current.jsonData.cloudName || 'azuremonitor';
        this.current.jsonData.azureLogAnalyticsSameAs = this.current.jsonData.azureLogAnalyticsSameAs || false;
        if (this.current.id) {
            this.current.url = '/api/datasources/proxy/' + this.current.id;
            this.azureLogAnalyticsDatasource = new AzureLogAnalyticsDatasource(this.current, backendSrv, null, $q);
            this.getWorkspaces();
        }
    }
    AzureMonitorConfigCtrl.prototype.hasMinVersion = function () {
        return isVersionGtOrEq(config.buildInfo.version, '5.2');
    };
    AzureMonitorConfigCtrl.prototype.showMinVersionWarning = function () {
        return !this.hasRequiredGrafanaVersion && this.current.secureJsonFields.logAnalyticsClientSecret;
    };
    AzureMonitorConfigCtrl.prototype.getWorkspaces = function () {
        var _this = this;
        if (!this.azureLogAnalyticsDatasource.isConfigured()) {
            return;
        }
        return this.azureLogAnalyticsDatasource.getWorkspaces().then(function (workspaces) {
            _this.workspaces = workspaces;
            if (_this.workspaces.length > 0) {
                _this.current.jsonData.logAnalyticsDefaultWorkspace =
                    _this.current.jsonData.logAnalyticsDefaultWorkspace || _this.workspaces[0].value;
            }
        });
    };
    AzureMonitorConfigCtrl.templateUrl = 'public/app/plugins/datasource/grafana-azure-monitor-datasource/partials/config.html';
    return AzureMonitorConfigCtrl;
}());
export { AzureMonitorConfigCtrl };
//# sourceMappingURL=config_ctrl.js.map