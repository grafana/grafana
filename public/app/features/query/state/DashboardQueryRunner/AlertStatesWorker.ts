import { from, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { getBackendSrv } from '@grafana/runtime';

import { DashboardQueryRunnerOptions, DashboardQueryRunnerWorker, DashboardQueryRunnerWorkerResult } from './types';
import { emptyResult, handleDashboardQueryRunnerWorkerError } from './utils';

export class AlertStatesWorker implements DashboardQueryRunnerWorker {
  canWork({ dashboard, range }: DashboardQueryRunnerOptions): boolean {
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
