import { Observable } from 'rxjs';
import { QueryRunnerOptions } from 'app/features/dashboard/state/PanelQueryRunner';
import { DashboardQuery, SHARED_DASHBODARD_QUERY } from './types';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { LoadingState, DefaultTimeRange, DataQuery, PanelData, DataSourceApi } from '@grafana/data';

export function isSharedDashboardQuery(datasource: string | DataSourceApi) {
  if (!datasource) {
    // default datasource
    return false;
  }
  if (datasource === SHARED_DASHBODARD_QUERY) {
    return true;
  }
  const ds = datasource as DataSourceApi;
  return ds.meta && ds.meta.name === SHARED_DASHBODARD_QUERY;
}

export function runSharedRequest(options: QueryRunnerOptions): Observable<PanelData> {
  return new Observable<PanelData>(subscriber => {
    const dashboard = getDashboardSrv().getCurrent();
    const listenToPanelId = getPanelIdFromQuery(options.queries);

    if (!listenToPanelId) {
      subscriber.next(getQueryError('Missing panel reference ID'));
      return null;
    }

    const currentPanel = dashboard.getPanelById(options.panelId);
    const listenToPanel = dashboard.getPanelById(listenToPanelId);

    if (!listenToPanel) {
      subscriber.next(getQueryError('Unknown Panel: ' + listenToPanelId));
      return null;
    }

    const listenToRunner = listenToPanel.getQueryRunner();
    const subscription = listenToRunner.getData(false).subscribe({
      next: (data: PanelData) => {
        subscriber.next(data);
      },
    });

    // If we are in fullscreen the other panel will not execute any queries
    // So we have to trigger it from here
    if (currentPanel.fullscreen) {
      const { datasource, targets } = listenToPanel;
      const modified = {
        ...options,
        datasource,
        panelId: listenToPanelId,
        queries: targets,
      };
      listenToRunner.run(modified);
    }

    return () => {
      console.log('runSharedRequest unsubscribe');
      subscription.unsubscribe();
    };
  });
}

function getPanelIdFromQuery(queries: DataQuery[]): number | undefined {
  if (!queries || !queries.length) {
    return undefined;
  }
  return (queries[0] as DashboardQuery).panelId;
}

function getQueryError(msg: string): PanelData {
  return {
    state: LoadingState.Error,
    series: [],
    error: { message: msg },
    timeRange: DefaultTimeRange,
  };
}
