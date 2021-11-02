import coreModule from 'app/core/core_module';
import { appEvents } from 'app/core/app_events';
import { DashboardModel } from '../state/DashboardModel';
import { removePanel } from '../utils/panel';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { saveDashboard } from 'app/features/manage-dashboards/state/actions';
import { RemovePanelEvent } from '../../../types/events';
var DashboardSrv = /** @class */ (function () {
    function DashboardSrv() {
        var _this = this;
        this.onRemovePanel = function (panelId) {
            var dashboard = _this.getCurrent();
            if (dashboard) {
                removePanel(dashboard, dashboard.getPanelById(panelId), true);
            }
        };
        appEvents.subscribe(RemovePanelEvent, function (e) { return _this.onRemovePanel(e.payload); });
    }
    DashboardSrv.prototype.create = function (dashboard, meta) {
        return new DashboardModel(dashboard, meta);
    };
    DashboardSrv.prototype.setCurrent = function (dashboard) {
        this.dashboard = dashboard;
    };
    DashboardSrv.prototype.getCurrent = function () {
        if (!this.dashboard) {
            console.warn('Calling getDashboardSrv().getCurrent() without calling getDashboardSrv().setCurrent() first.');
        }
        return this.dashboard;
    };
    DashboardSrv.prototype.saveJSONDashboard = function (json) {
        var _a;
        var parsedJson = JSON.parse(json);
        return saveDashboard({
            dashboard: parsedJson,
            folderId: ((_a = this.dashboard) === null || _a === void 0 ? void 0 : _a.meta.folderId) || parsedJson.folderId,
        });
    };
    DashboardSrv.prototype.starDashboard = function (dashboardId, isStarred) {
        var _this = this;
        var backendSrv = getBackendSrv();
        var promise;
        if (isStarred) {
            promise = backendSrv.delete('/api/user/stars/dashboard/' + dashboardId).then(function () {
                return false;
            });
        }
        else {
            promise = backendSrv.post('/api/user/stars/dashboard/' + dashboardId).then(function () {
                return true;
            });
        }
        return promise.then(function (res) {
            if (_this.dashboard && _this.dashboard.id === dashboardId) {
                _this.dashboard.meta.isStarred = res;
            }
            return res;
        });
    };
    return DashboardSrv;
}());
export { DashboardSrv };
coreModule.service('dashboardSrv', DashboardSrv);
//
// Code below is to export the service to React components
//
var singletonInstance;
export function setDashboardSrv(instance) {
    singletonInstance = instance;
}
export function getDashboardSrv() {
    return singletonInstance;
}
//# sourceMappingURL=DashboardSrv.js.map