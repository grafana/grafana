import { DashboardQueryRunnerOptions, DashboardQueryRunnerWorker, DashboardQueryRunnerWorkerResult } from './types';
import { from, Observable } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';
import { catchError, map } from 'rxjs/operators';
import { emptyResult, handleDashboardQueryRunnerWorkerError } from './utils';

export class AlertStatesWorker implements DashboardQueryRunnerWorker {
  canWork({ dashboard, range }: DashboardQueryRunnerOptions): boolean {
    if (!dashboard.id) {
      return false;
    }

    if (range.raw.to !== 'now') {
      return false;
    }

    return true;
  }

  work(options: DashboardQueryRunnerOptions): Observable<DashboardQueryRunnerWorkerResult> {
    if (!this.canWork(options)) {
      return emptyResult();
    }

    const { dashboard } = options;
    return from(
      getBackendSrv().get(
        '/api/alerts/states-for-dashboard',
        {
          dashboardId: dashboard.id,
        },
        `dashboard-query-runner-alert-states-${dashboard.id}`
      )
    ).pipe(
      map((alertStates) => {
        return { alertStates, annotations: [] };
      }),
      catchError(handleDashboardQueryRunnerWorkerError)
    );
  }
}
