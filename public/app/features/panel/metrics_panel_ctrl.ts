import _ from 'lodash';

import kbn from 'app/core/utils/kbn';

import { PanelCtrl } from 'app/features/panel/panel_ctrl';
import { getExploreUrl } from 'app/core/utils/explore';
import { applyPanelTimeOverrides, getResolution } from 'app/features/dashboard/utils/panel';
import { ContextSrv } from 'app/core/services/context_srv';
import {
  DataFrame,
  DataQueryResponse,
  DataSourceApi,
  LegacyResponseData,
  LoadingState,
  PanelData,
  PanelEvents,
  TimeRange,
  toDataFrameDTO,
  toLegacyResponseData,
} from '@grafana/data';
import { Unsubscribable } from 'rxjs';
import { PanelModel } from 'app/features/dashboard/state';
import { CoreEvents } from 'app/types';

class MetricsPanelCtrl extends PanelCtrl {
  scope: any;
  datasource: DataSourceApi;
  $q: any;
  $timeout: any;
  contextSrv: ContextSrv;
  datasourceSrv: any;
  timeSrv: any;
  templateSrv: any;
  range: TimeRange;
  interval: any;
  intervalMs: any;
  resolution: any;
  timeInfo?: string;
  skipDataOnInit: boolean;
  dataList: LegacyResponseData[];
  querySubscription?: Unsubscribable;
  useDataFrames = false;

  constructor($scope: any, $injector: any) {
    super($scope, $injector);

    this.$q = $injector.get('$q');
    this.contextSrv = $injector.get('contextSrv');
    this.datasourceSrv = $injector.get('datasourceSrv');
    this.timeSrv = $injector.get('timeSrv');
    this.templateSrv = $injector.get('templateSrv');
    this.scope = $scope;
    this.panel.datasource = this.panel.datasource || null;

    this.events.on(PanelEvents.refresh, this.onMetricsPanelRefresh.bind(this));
    this.events.on(PanelEvents.panelTeardown, this.onPanelTearDown.bind(this));
  }

  private onPanelTearDown() {
    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
      this.querySubscription = null;
    }
  }

  private onMetricsPanelRefresh() {
    // ignore fetching data if another panel is in fullscreen
    if (this.otherPanelInFullscreenMode()) {
      return;
    }

    // if we have snapshot data use that
    if (this.panel.snapshotData) {
      this.updateTimeRange();
      let data = this.panel.snapshotData;
      // backward compatibility
      if (!_.isArray(data)) {
        data = data.data;
      }

      // Defer panel rendering till the next digest cycle.
      // For some reason snapshot panels don't init at this time, so this helps to avoid rendering issues.
      return this.$timeout(() => {
        this.events.emit(PanelEvents.dataSnapshotLoad, data);
      });
    }

    // clear loading/error state
    delete this.error;
    this.loading = true;

    // load datasource service
    return this.datasourceSrv
      .get(this.panel.datasource, this.panel.scopedVars)
      .then(this.updateTimeRange.bind(this))
      .then(this.issueQueries.bind(this))
      .catch((err: any) => {
        this.processDataError(err);
      });
  }

  processDataError(err: any) {
    // if canceled  keep loading set to true
    if (err.cancelled) {
      console.log('Panel request cancelled', err);
      return;
    }

    this.error = err.message || 'Request Error';

    if (err.data) {
      if (err.data.message) {
        this.error = err.data.message;
      } else if (err.data.error) {
        this.error = err.data.error;
      }
    }
  }

  // Updates the response with information from the stream
  panelDataObserver = {
    next: (data: PanelData) => {
      if (data.state === LoadingState.Error) {
        this.loading = false;
        this.processDataError(data.error);
      }

      // Ignore data in loading state
      if (data.state === LoadingState.Loading) {
        this.loading = true;
        return;
      }

      if (data.request) {
        const { timeInfo } = data.request;
        if (timeInfo) {
          this.timeInfo = timeInfo;
        }
      }

      if (data.timeRange) {
        this.range = data.timeRange;
      }

      if (this.useDataFrames) {
        this.handleDataFrames(data.series);
      } else {
        // Make the results look as if they came directly from a <6.2 datasource request
        const legacy = data.series.map(v => toLegacyResponseData(v));
        this.handleQueryResult({ data: legacy });
      }
    },
  };

  updateTimeRange(datasource?: DataSourceApi) {
    this.datasource = datasource || this.datasource;
    this.range = this.timeSrv.timeRange();
    this.resolution = getResolution(this.panel);

    const newTimeData = applyPanelTimeOverrides(this.panel, this.range);
    this.timeInfo = newTimeData.timeInfo;
    this.range = newTimeData.timeRange;

    this.calculateInterval();

    return this.datasource;
  }

  calculateInterval() {
    let intervalOverride = this.panel.interval;

    // if no panel interval check datasource
    if (intervalOverride) {
      intervalOverride = this.templateSrv.replace(intervalOverride, this.panel.scopedVars);
    } else if (this.datasource && this.datasource.interval) {
      intervalOverride = this.datasource.interval;
    }

    const res = kbn.calculateInterval(this.range, this.resolution, intervalOverride);
    this.interval = res.interval;
    this.intervalMs = res.intervalMs;
  }

  issueQueries(datasource: DataSourceApi) {
    this.datasource = datasource;

    const panel = this.panel as PanelModel;
    const queryRunner = panel.getQueryRunner();

    if (!this.querySubscription) {
      this.querySubscription = queryRunner.getData().subscribe(this.panelDataObserver);
    }

    return queryRunner.run({
      datasource: panel.datasource,
      queries: panel.targets,
      panelId: panel.id,
      dashboardId: this.dashboard.id,
      timezone: this.dashboard.timezone,
      timeRange: this.range,
      widthPixels: this.resolution, // The pixel width
      maxDataPoints: panel.maxDataPoints,
      minInterval: panel.interval,
      scopedVars: panel.scopedVars,
      cacheTimeout: panel.cacheTimeout,
      transformations: panel.transformations,
    });
  }

  handleDataFrames(data: DataFrame[]) {
    this.loading = false;

    if (this.dashboard && this.dashboard.snapshot) {
      this.panel.snapshotData = data.map(frame => toDataFrameDTO(frame));
    }

    try {
      this.events.emit(CoreEvents.dataFramesReceived, data);
    } catch (err) {
      this.processDataError(err);
    }
  }

  handleQueryResult(result: DataQueryResponse) {
    this.loading = false;

    if (this.dashboard.snapshot) {
      this.panel.snapshotData = result.data;
    }

    if (!result || !result.data) {
      console.log('Data source query result invalid, missing data field:', result);
      result = { data: [] };
    }

    try {
      this.events.emit(PanelEvents.dataReceived, result.data);
    } catch (err) {
      this.processDataError(err);
    }
  }

  async getAdditionalMenuItems() {
    const items = [];
    if (this.contextSrv.hasAccessToExplore() && this.datasource) {
      items.push({
        text: 'Explore',
        icon: 'gicon gicon-explore',
        shortcut: 'x',
        href: await getExploreUrl({
          panel: this.panel,
          panelTargets: this.panel.targets,
          panelDatasource: this.datasource,
          datasourceSrv: this.datasourceSrv,
          timeSrv: this.timeSrv,
        }),
      });
    }
    return items;
  }
}

export { MetricsPanelCtrl };
