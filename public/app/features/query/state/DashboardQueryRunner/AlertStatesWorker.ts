import { DashboardQueryRunnerOptions, DashboardQueryRunnerWorker, DashboardQueryRunnerWorkerResult } from './types';
import { from, Observable } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';
import { map } from 'rxjs/operators';
import { emptyResult } from './DashboardQueryRunner';

export class AlertStatesWorker implements DashboardQueryRunnerWorker {
  canRun({ dashboard, range }: DashboardQueryRunnerOptions): boolean {
    if (!dashboard.id) {
      return false;
    }

    if (range.raw.to !== 'now') {
      return false;
    }

    return true;
  }

  run(options: DashboardQueryRunnerOptions): Observable<DashboardQueryRunnerWorkerResult> {
    if (!this.canRun(options)) {
      return emptyResult();
    }

    console.log('Running AlertStatesWorker');
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
      })
    );
  }
}
