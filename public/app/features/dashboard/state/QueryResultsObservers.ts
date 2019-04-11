// Types
import {
  DataQueryResponse,
  SeriesData,
  LegacyResponseData,
  isSeriesData,
  toLegacyResponseData,
  TimeRange,
} from '@grafana/ui';
import { PanelModel } from './PanelModel';
import { Subject, PartialObserver } from 'rxjs';
import { getProcessedSeriesData } from '../dashgrid/DataPanel';
import { DashboardModel } from './DashboardModel';
import { DashboardQuery } from 'app/plugins/datasource/dashboard/types';

export const SHARED_DASHBODARD_QUERY = '-- Dashboard --';

type PanelQueryResults = {
  panelId: number;
  raw: DataQueryResponse;
  range: TimeRange;
};

export type ReactQueryResults = PanelQueryResults & {
  series: SeriesData[];
};

export type AngularQueryResults = PanelQueryResults & {
  data: LegacyResponseData[];
};

export function checkQueryResultsObservers(
  panel: PanelModel,
  dashboard: DashboardModel,
  observer: PartialObserver<AngularQueryResults | ReactQueryResults>
) {
  if (!panel.targets || !dashboard) {
    return; // No query created
  }

  const query = panel.targets[0] as DashboardQuery;
  const watch = dashboard.getPanelById(query.panelId);
  if (watch) {
    if (!watch.queryObservers) {
      watch.queryObservers = new QueryResultsObservers(watch);
    }
    watch.queryObservers.subscribe(panel, observer);
    console.log('TODO, check if refresh was called recently');
  }
  return;
}

export class QueryResultsObservers {
  reactPanels = new Subject<ReactQueryResults>();
  angularPanels = new Subject<AngularQueryResults>();
  constructor(private parent: PanelModel) {}

  private closeIfNoListeners() {
    if (this.reactPanels.observers) {
      return;
    }
    if (this.angularPanels.observers) {
      return;
    }
    console.log('No more listeners... shut down the observers...');
    this.close();
  }

  close() {
    this.parent.queryObservers = null;
    this.reactPanels.complete();
    this.angularPanels.complete();
  }

  subscribe = (panel: PanelModel, observer: PartialObserver<AngularQueryResults | ReactQueryResults>): boolean => {
    if (panel.queryListener) {
      return false; // already listenting to somthing
    }

    const isAngular: boolean = !!panel.plugin.angularPlugin;
    if (isAngular) {
      panel.queryListener = this.angularPanels.subscribe(observer);
    } else {
      panel.queryListener = this.reactPanels.subscribe(observer);
    }
    return true;
  };

  broadcastReactResuls(res: ReactQueryResults) {
    this.reactPanels.next(res);
    if (this.angularPanels.observers.length > 0) {
      this.angularPanels.next({
        ...res,

        // Same calculation as metrics_panel_ctrl
        data: res.raw.data.map(v => {
          if (isSeriesData(v)) {
            return toLegacyResponseData(v);
          }
          return v;
        }),
      });
    }
    this.closeIfNoListeners();
  }

  broadcastAngularResuls(res: AngularQueryResults) {
    this.angularPanels.next(res);
    if (this.reactPanels.observers.length > 0) {
      this.reactPanels.next({
        ...res,

        // Same calculation as DataPanel
        series: getProcessedSeriesData(res.raw.data),
      });
    }
    this.closeIfNoListeners();
  }
}
