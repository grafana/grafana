import { DataSourceApi, DataQuery, PanelData, LoadingState } from '@grafana/ui';
import { PanelQueryRunner } from 'app/features/dashboard/state/PanelQueryRunner';
import { toDataQueryError } from 'app/features/dashboard/state/PanelQueryState';
import { DashboardQuery } from './types';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { Unsubscribable } from 'rxjs';
import { PanelModel } from 'app/features/dashboard/state';

export const SHARED_DASHBODARD_QUERY = '-- Dashboard --';

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

export class SharedQueryRunner {
  private listenId: number;
  private listenPanel: PanelModel;
  private listenRunner: PanelQueryRunner;
  private subscription: Unsubscribable;

  constructor(private runner: PanelQueryRunner) {}

  process(queries: DataQuery[]): Promise<PanelData> {
    const panelId = getPanelIdFromQuery(queries);
    if (!panelId) {
      this.disconnect();
      return getQueryError('Missing panel reference ID');
    }

    // The requested panel changed
    if (this.listenId !== panelId) {
      this.disconnect();

      this.listenPanel = getDashboardSrv()
        .getCurrent()
        .getPanelById(panelId);
      if (!this.listenPanel) {
        return getQueryError('Unknown Panel: ' + panelId);
      }
      this.listenRunner = this.listenPanel.getQueryRunner();
      this.subscription = this.listenRunner.chain(this.runner);
    }

    const data = this.listenRunner.getCurrentData();
    if (data.request && data.request.startTime) {
      const elapsed = Date.now() - data.request.startTime;
      if (elapsed < 1000) {
        return Promise.resolve(data);
      }
    }
    this.listenPanel.refresh(); // ????? Won't really work often
    return Promise.resolve(data);
  }

  disconnect() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    if (this.listenPanel) {
      this.listenPanel = null;
    }
    this.listenId = undefined;
  }
}

function getPanelIdFromQuery(queries: DataQuery[]): number | undefined {
  if (!queries || !queries.length) {
    return undefined;
  }
  return (queries[0] as DashboardQuery).panelId;
}

function getQueryError(msg: string): Promise<PanelData> {
  return Promise.resolve({
    state: LoadingState.Error,
    series: [],
    legacy: [],
    error: toDataQueryError(msg),
  });
}
