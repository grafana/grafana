import _ from 'lodash';

import kbn from 'app/core/utils/kbn';

import { PanelCtrl } from 'app/features/panel/panel_ctrl';
import { getExploreUrl } from 'app/core/utils/explore';
import { applyPanelTimeOverrides, getResolution } from 'app/features/dashboard/utils/panel';
import { ContextSrv } from 'app/core/services/context_srv';
import { toLegacyResponseData, isDataFrame, TimeRange, LoadingState, DataFrame, toDataFrameDTO } from '@grafana/data';

import { LegacyResponseData, DataSourceApi, PanelData, DataQueryResponse } from '@grafana/ui';
import { Unsubscribable } from 'rxjs';
import { PanelModel } from 'app/features/dashboard/state';
import { PanelQueryRunnerFormat } from '../dashboard/state/PanelQueryRunner';

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
  dataFormat = PanelQueryRunnerFormat.legacy;

  constructor($scope: any, $injector: any) {
    super($scope, $injector);

    this.$q = $injector.get('$q');
    this.contextSrv = $injector.get('contextSrv');
    this.datasourceSrv = $injector.get('datasourceSrv');
    this.timeSrv = $injector.get('timeSrv');
    this.templateSrv = $injector.get('templateSrv');
    this.scope = $scope;
    this.panel.datasource = this.panel.datasource || null;

    this.events.on('refresh', this.onMetricsPanelRefresh.bind(this));
    this.events.on('panel-teardown', this.onPanelTearDown.bind(this));
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
        this.events.emit('data-snapshot-load', data);
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

    this.loading = false;
    this.error = err.message || 'Request Error';
    this.inspector = { error: err };

    if (err.data) {
      if (err.data.message) {
        this.error = err.data.message;
      }
      if (err.data.error) {
        this.error = err.data.error;
      }
    }

    console.log('Panel data error:', err);
    return this.$timeout(() => {
      this.events.emit('data-error', err);
    });
  }

  // Updates the response with information from the stream
  panelDataObserver = {
    next: (data: PanelData) => {
      if (data.state === LoadingState.Error) {
        this.loading = false;
        this.processDataError(data.error);
        return;
      }

      // Ignore data in loading state
      if (data.state === LoadingState.Loading) {
        this.loading = true;
        return;
      }

      if (data.request) {
        const { range, timeInfo } = data.request;
        if (range) {
          this.range = range;
        }
        if (timeInfo) {
          this.timeInfo = timeInfo;
        }
      }

      if (this.dataFormat === PanelQueryRunnerFormat.legacy) {
        // The result should already be processed, but just in case
        if (!data.legacy) {
          data.legacy = data.series.map(v => {
            if (isDataFrame(v)) {
              return toLegacyResponseData(v);
            }
            return v;
          });
        }

        // Make the results look like they came directly from a <6.2 datasource request
        // NOTE: any object other than 'data' is no longer supported supported
        this.handleQueryResult({ data: data.legacy });
      } else {
        this.handleDataFrames(data.series);
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
      this.querySubscription = queryRunner.subscribe(this.panelDataObserver, this.dataFormat);
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
    });
  }

  handleDataFrames(data: DataFrame[]) {
    this.loading = false;

    if (this.dashboard && this.dashboard.snapshot) {
      this.panel.snapshotData = data.map(frame => toDataFrameDTO(frame));
    }

    try {
      this.events.emit('data-frames-received', data);
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
      this.events.emit('data-received', result.data);
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
        href: await getExploreUrl(this.panel, this.panel.targets, this.datasource, this.datasourceSrv, this.timeSrv),
      });
    }
    return items;
  }

  async explore() {
    const url = await getExploreUrl(this.panel, this.panel.targets, this.datasource, this.datasourceSrv, this.timeSrv);
    if (url) {
      this.$timeout(() => this.$location.url(url));
    }
  }
}

export { MetricsPanelCtrl };
