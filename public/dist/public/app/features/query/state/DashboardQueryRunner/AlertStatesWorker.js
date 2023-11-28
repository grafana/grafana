import { from } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { getBackendSrv } from '@grafana/runtime';
import { emptyResult, handleDashboardQueryRunnerWorkerError } from './utils';
export class AlertStatesWorker {
    canWork({ dashboard, range }) {
        if (!dashboard.id) {
            return false;
        }
        if (range.raw.to !== 'now') {
            return false;
        }
        // if dashboard has no alerts, no point to query alert states
        if (!dashboard.panels.find((panel) => !!panel.alert)) {
            return false;
        }
        return true;
    }
    work(options) {
        if (!this.canWork(options)) {
            return emptyResult();
        }
        const { dashboard } = options;
        return from(getBackendSrv().get('/api/alerts/states-for-dashboard', {
            dashboardId: dashboard.id,
        }, `dashboard-query-runner-alert-states-${dashboard.id}`)).pipe(map((alertStates) => {
            return { alertStates, annotations: [] };
        }), catchError(handleDashboardQueryRunnerWorkerError));
    }
}
//# sourceMappingURL=AlertStatesWorker.js.map