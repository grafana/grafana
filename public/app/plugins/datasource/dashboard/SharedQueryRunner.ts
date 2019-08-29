import { DataSourceApi, DataQuery, PanelData } from '@grafana/ui';
import { PanelQueryRunner, QueryRunnerOptions } from 'app/features/dashboard/state/PanelQueryRunner';
import { toDataQueryError } from 'app/features/dashboard/state/PanelQueryState';
import { DashboardQuery } from './types';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { Unsubscribable } from 'rxjs';
import { PanelModel } from 'app/features/dashboard/state';
import { LoadingState } from '@grafana/data';

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
  private containerPanel: PanelModel;
  private listenToPanelId: number;
  private listenToPanel: PanelModel;
  private listenToRunner: PanelQueryRunner;
  private subscription: Unsubscribable;

  constructor(private runner: PanelQueryRunner) {
    this.containerPanel = getDashboardSrv()
      .getCurrent()
      .getPanelById(runner.getPanelId());
  }

  process(options: QueryRunnerOptions): Promise<PanelData> {
    const panelId = getPanelIdFromQuery(options.queries);

    if (!panelId) {
      this.disconnect();
      return getQueryError('Missing panel reference ID');
    }

    // The requested panel changed
    if (this.listenToPanelId !== panelId) {
      this.disconnect();

      this.listenToPanel = getDashboardSrv()
        .getCurrent()
        .getPanelById(panelId);

      if (!this.listenToPanel) {
        return getQueryError('Unknown Panel: ' + panelId);
      }

      this.listenToPanelId = panelId;
      this.listenToRunner = this.listenToPanel.getQueryRunner();
      this.subscription = this.listenToRunner.chain(this.runner);
      console.log('Connecting panel: ', this.containerPanel.id, 'to:', this.listenToPanelId);
    }

    // If the target has refreshed recently, use the exising data
    const data = this.listenToRunner.getCurrentData();
    if (data.request && data.request.startTime) {
      const elapsed = Date.now() - data.request.startTime;
      if (elapsed < 150) {
        return Promise.resolve(data);
      }
    }

    // When fullscreen run with the current panel settings
    if (this.containerPanel.fullscreen) {
      const { datasource, targets } = this.listenToPanel;
      const modified = {
        ...options,
        panelId,
        datasource,
        queries: targets,
      };
      return this.listenToRunner.run(modified);
    } else {
      this.listenToPanel.refresh();
    }

    return Promise.resolve(data);
  }

  disconnect() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    if (this.listenToPanel) {
      this.listenToPanel = null;
    }
    this.listenToPanelId = undefined;
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
