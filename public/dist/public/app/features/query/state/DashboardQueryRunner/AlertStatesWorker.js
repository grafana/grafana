import { from } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';
import { catchError, map } from 'rxjs/operators';
import { emptyResult, handleDashboardQueryRunnerWorkerError } from './utils';
var AlertStatesWorker = /** @class */ (function () {
    function AlertStatesWorker() {
    }
    AlertStatesWorker.prototype.canWork = function (_a) {
        var dashboard = _a.dashboard, range = _a.range;
        if (!dashboard.id) {
            return false;
        }
        if (range.raw.to !== 'now') {
            return false;
        }
        // if dashboard has no alerts, no point to query alert states
        if (!dashboard.panels.find(function (panel) { return !!panel.alert; })) {
            return false;
        }
        return true;
    };
    AlertStatesWorker.prototype.work = function (options) {
        if (!this.canWork(options)) {
            return emptyResult();
        }
        var dashboard = options.dashboard;
        return from(getBackendSrv().get('/api/alerts/states-for-dashboard', {
            dashboardId: dashboard.id,
        }, "dashboard-query-runner-alert-states-" + dashboard.id)).pipe(map(function (alertStates) {
            return { alertStates: alertStates, annotations: [] };
        }), catchError(handleDashboardQueryRunnerWorkerError));
    };
    return AlertStatesWorker;
}());
export { AlertStatesWorker };
//# sourceMappingURL=AlertStatesWorker.js.map