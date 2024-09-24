import { Observable, from } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { PanelModel } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';
import { CorrelationData } from 'app/features/correlations/useCorrelations';
import { getCorrelationsBySourceUIDs } from 'app/features/correlations/utils';

import { DashboardQueryRunnerOptions, DashboardQueryRunnerWorker, DashboardQueryRunnerWorkerResult } from './types';
import { emptyResult, handleDashboardQueryRunnerWorkerError } from './utils';

async function getCorrelationsForDashboard(panels: PanelModel[]): Promise<CorrelationData[]> {
  // todo mixed scenario
  const datasources = panels
    .map((panel) => panel.datasource)
    .filter((ds): ds is DataSourceRef => !!ds && ds.uid !== undefined)
    .map((ds) => ds.uid!);
  return (await getCorrelationsBySourceUIDs(datasources)).correlations;
}

export class CorrelationsWorker implements DashboardQueryRunnerWorker {
  canWork({ dashboard, range }: DashboardQueryRunnerOptions): boolean {
    //TODO figure out logic
    return true;
  }

  work(options: DashboardQueryRunnerOptions): Observable<DashboardQueryRunnerWorkerResult> {
    if (!this.canWork(options)) {
      return emptyResult();
    }

    const { dashboard } = options;

    return from(getCorrelationsForDashboard(dashboard.panels)).pipe(
      map((correlations: CorrelationData[]) => {
        return { correlations, alertStates: [], annotations: [] };
      }),
      catchError(handleDashboardQueryRunnerWorkerError)
    );
  }
}
