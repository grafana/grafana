import _ from 'lodash';

import config from 'app/core/config';
// import kbn from 'app/core/utils/kbn';
import { PanelCtrl } from 'app/features/panel/panel_ctrl';
import { getExploreUrl } from 'app/core/utils/explore';
import { metricsTabDirective } from './metrics_tab';
import {
  applyPanelTimeOverrides as applyPanelTimeOverridesUtil,
  calculateInterval as calculateIntervalUtil,
  getResolution,
} from 'app/features/dashboard/utils/panel';
import { TimeData } from 'app/types';

class MetricsPanelCtrl extends PanelCtrl {
  scope: any;
  datasource: any;
  $q: any;
  $timeout: any;
  contextSrv: any;
  datasourceSrv: any;
  timeSrv: any;
  templateSrv: any;
  timing: any;
  range: any;
  interval: any;
  intervalMs: any;
  resolution: any;
  timeInfo: any;
  skipDataOnInit: boolean;
  dataStream: any;
  dataSubscription: any;
  dataList: any;
  nextRefId: string;

  constructor($scope, $injector) {
    super($scope, $injector);

    // make metrics tab the default
    this.editorTabIndex = 1;
    this.$q = $injector.get('$q');
    this.contextSrv = $injector.get('contextSrv');
    this.datasourceSrv = $injector.get('datasourceSrv');
    this.timeSrv = $injector.get('timeSrv');
    this.templateSrv = $injector.get('templateSrv');
    this.scope = $scope;
    this.panel.datasource = this.panel.datasource || null;

    this.events.on('refresh', this.onMetricsPanelRefresh.bind(this));
    this.events.on('init-edit-mode', this.onInitMetricsPanelEditMode.bind(this));
    this.events.on('panel-teardown', this.onPanelTearDown.bind(this));
  }

  private onPanelTearDown() {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
      this.dataSubscription = null;
    }
  }

  private onInitMetricsPanelEditMode() {
    this.addEditorTab('Metrics', metricsTabDirective, 1, 'fa fa-database');
    this.addEditorTab('Time range', 'public/app/features/panel/partials/panelTime.html');
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

    // // ignore if we have data stream
    if (this.dataStream) {
      return;
    }

    // clear loading/error state
    delete this.error;
    this.loading = true;

    // load datasource service
    this.setTimeQueryStart();
    this.datasourceSrv
      .get(this.panel.datasource)
      .then(this.updateTimeRange.bind(this))
      .then(this.issueQueries.bind(this))
      .then(this.handleQueryResult.bind(this))
      .catch(err => {
        // if cancelled  keep loading set to true
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

  setTimeQueryStart() {
    this.timing.queryStart = new Date().getTime();
  }

  setTimeQueryEnd() {
    this.timing.queryEnd = new Date().getTime();
  }

  updateTimeRange(datasource?) {
    this.datasource = datasource || this.datasource;
    this.range = this.timeSrv.timeRange();

    this.applyPanelTimeOverrides();

    this.resolution = getResolution(this.panel);

    this.calculateInterval();

    return this.datasource;
  }

  calculateInterval() {
    // let intervalOverride = this.panel.interval;

    // // if no panel interval check datasource
    // if (intervalOverride) {
    //   intervalOverride = this.templateSrv.replace(intervalOverride, this.panel.scopedVars);
    // } else if (this.datasource && this.datasource.interval) {
    //   intervalOverride = this.datasource.interval;
    // }

    // const res = kbn.calculateInterval(this.range, this.resolution, intervalOverride);
    // this.interval = res.interval;
    // this.intervalMs = res.intervalMs;

    const interval = calculateIntervalUtil(this.panel, this.datasource, this.range, this.resolution);
    this.interval = interval.interval;
    this.intervalMs = this.intervalMs;
  }

  applyPanelTimeOverrides() {
    const timeData: TimeData = {
      timeInfo: '',
      timeRange: this.range,
    };

    const newTimeData = applyPanelTimeOverridesUtil(this.panel, timeData);
    this.timeInfo = newTimeData.timeInfo;
    this.range = newTimeData.timeRange;
  }

  issueQueries(datasource) {
    this.datasource = datasource;

    if (!this.panel.targets || this.panel.targets.length === 0) {
      return this.$q.when([]);
    }

    // make shallow copy of scoped vars,
    // and add built in variables interval and interval_ms
    const scopedVars = Object.assign({}, this.panel.scopedVars, {
      __interval: { text: this.interval, value: this.interval },
      __interval_ms: { text: this.intervalMs, value: this.intervalMs },
    });

    const metricsQuery = {
      timezone: this.dashboard.getTimezone(),
      panelId: this.panel.id,
      dashboardId: this.dashboard.id,
      range: this.range,
      rangeRaw: this.range.raw,
      interval: this.interval,
      intervalMs: this.intervalMs,
      targets: this.panel.targets,
      maxDataPoints: this.resolution,
      scopedVars: scopedVars,
      cacheTimeout: this.panel.cacheTimeout,
    };

    return datasource.query(metricsQuery);
  }

  handleQueryResult(result) {
    this.setTimeQueryEnd();
    this.loading = false;

    // check for if data source returns subject
    if (result && result.subscribe) {
      this.handleDataStream(result);
      return;
    }

    if (this.dashboard.snapshot) {
      this.panel.snapshotData = result.data;
    }

    if (!result || !result.data) {
      console.log('Data source query result invalid, missing data field:', result);
      result = { data: [] };
    }

    this.events.emit('data-received', result.data);
  }

  handleDataStream(stream) {
    // if we already have a connection
    if (this.dataStream) {
      console.log('two stream observables!');
      return;
    }

    this.dataStream = stream;
    this.dataSubscription = stream.subscribe({
      next: data => {
        console.log('dataSubject next!');
        if (data.range) {
          this.range = data.range;
        }
        this.events.emit('data-received', data.data);
      },
      error: error => {
        this.events.emit('data-error', error);
        console.log('panel: observer got error');
      },
      complete: () => {
        console.log('panel: observer got complete');
        this.dataStream = null;
      },
    });
  }

  getAdditionalMenuItems() {
    const items = [];
    if (
      config.exploreEnabled &&
      this.contextSrv.isEditor &&
      this.datasource &&
      (this.datasource.meta.explore || this.datasource.meta.id === 'mixed')
    ) {
      items.push({
        text: 'Explore',
        click: 'ctrl.explore();',
        icon: 'fa fa-fw fa-rocket',
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

  addQuery(target) {
    target.refId = this.dashboard.getNextQueryLetter(this.panel);

    this.panel.targets.push(target);
    this.nextRefId = this.dashboard.getNextQueryLetter(this.panel);
  }

  removeQuery(target) {
    const index = _.indexOf(this.panel.targets, target);
    this.panel.targets.splice(index, 1);
    this.nextRefId = this.dashboard.getNextQueryLetter(this.panel);
    this.refresh();
  }

  moveQuery(target, direction) {
    const index = _.indexOf(this.panel.targets, target);
    _.move(this.panel.targets, index, index + direction);
  }
}

export { MetricsPanelCtrl };
