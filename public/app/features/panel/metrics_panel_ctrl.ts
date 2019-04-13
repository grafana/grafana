import _ from 'lodash';

import kbn from 'app/core/utils/kbn';

import { PanelCtrl } from 'app/features/panel/panel_ctrl';
import { getExploreUrl } from 'app/core/utils/explore';
import { applyPanelTimeOverrides, getResolution } from 'app/features/dashboard/utils/panel';
import { ContextSrv } from 'app/core/services/context_srv';
import { LegacyResponseData, TimeRange, DataSourceApi, DataQueryResponse, LoadingState } from '@grafana/ui';
import { Unsubscribable } from 'rxjs';
import { PanelQueryRunner, QueryResponseEvent } from '../dashboard/state/PanelQueryRunner';
import { PanelModel } from 'app/features/dashboard/state';

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

    // Setup the query runner
    const panelModel = this.panel as PanelModel;
    if (!panelModel.queryRunner) {
      panelModel.queryRunner = new PanelQueryRunner();
    }
    this.querySubscription = panelModel.queryRunner.subscribe(this.queryResponseObserver, true);
  }

  // Respond to the query response
  queryResponseObserver = {
    next: (event: QueryResponseEvent) => {
      const { loading, legacy } = event;
      if (legacy && loading !== LoadingState.Loading) {
        this.handleQueryResult({ data: legacy });
      }
    },
  };

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
    this.datasourceSrv
      .get(this.panel.datasource, this.panel.scopedVars)
      .then(this.updateTimeRange.bind(this))
      .then(this.issueQueries.bind(this))
      .catch(err => {
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

        this.events.emit('data-error', err);
        console.log('Panel data error:', err);
      });
  }

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

    // No longer passed in:
    // interval: this.interval,
    // intervalMs: this.intervalMs,

    const runner = this.panel.queryRunner as PanelQueryRunner;
    runner.run({
      ds: datasource,
      datasource: this.panel.datasource, // The name
      timezone: this.dashboard.getTimezone(),
      panelId: this.panel.id,
      dashboardId: this.dashboard.id,
      timeRange: this.range,
      queries: this.panel.targets,
      scopedVars: this.panel.scopedVars,
      cacheTimeout: this.panel.cacheTimeout,

      maxDataPoints: this.resolution,
      widthPixels: 1000, // Not used -- it is the resolution above
    });

    // ???? shoud we wait for the data to finish before return ????
    // It is not necessary in this structure, but some plugins may care?
  }

  // since Grafana 6.2, this is called from `queryResponseListener` above
  handleQueryResult(result: DataQueryResponse) {
    this.loading = false;

    if (this.dashboard.snapshot) {
      this.panel.snapshotData = result.data;
    }

    if (!result || !result.data) {
      console.log('Data source query result invalid, missing data field:', result);
      result = { data: [] };
    }

    // The results are already converted to LegacyResponseData[]
    this.events.emit('data-received', result.data);
  }

  getAdditionalMenuItems() {
    const items = [];
    if (this.contextSrv.hasAccessToExplore() && this.datasource) {
      items.push({
        text: 'Explore',
        click: 'ctrl.explore();',
        icon: 'gicon gicon-explore',
        shortcut: 'x',
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
