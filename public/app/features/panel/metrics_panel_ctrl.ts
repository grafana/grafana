///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import $ from 'jquery';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import {PanelCtrl} from './panel_ctrl';

import * as rangeUtil from 'app/core/utils/rangeutil';
import * as dateMath from 'app/core/utils/datemath';

class MetricsPanelCtrl extends PanelCtrl {
  error: boolean;
  loading: boolean;
  datasource: any;
  $q: any;
  $timeout: any;
  datasourceSrv: any;
  timeSrv: any;
  timing: any;
  range: any;
  rangeRaw: any;
  interval: any;
  resolution: any;
  timeInfo: any;
  skipDataOnInit: boolean;
  datasources: any[];

  constructor($scope, $injector) {
    super($scope, $injector);

    // make metrics tab the default
    this.editorTabIndex = 1;
    this.$q = $injector.get('$q');
    this.datasourceSrv = $injector.get('datasourceSrv');
    this.timeSrv = $injector.get('timeSrv');

    if (!this.panel.targets) {
      this.panel.targets = [{}];
    }
  }

  initEditMode() {
    super.initEditMode();
    this.addEditorTab('Metrics', 'public/app/partials/metrics.html');
    this.addEditorTab('Time range', 'public/app/features/panel/partials/panelTime.html');
    this.datasources = this.datasourceSrv.getMetricSources();
  }

  refreshData(data) {
    // null op
    return this.$q.when(data);
  }

  loadSnapshot(data) {
    // null op
    return data;
  }

  refresh() {
    // ignore fetching data if another panel is in fullscreen
    if (this.otherPanelInFullscreenMode()) { return; }

    // if we have snapshot data use that
    if (this.panel.snapshotData) {
      if (this.loadSnapshot) {
        this.updateTimeRange();
        this.loadSnapshot(this.panel.snapshotData);
      }
      return;
    }

    // clear loading/error state
    delete this.error;
    this.loading = true;

    // load datasource service
    this.datasourceSrv.get(this.panel.datasource).then(datasource => {
      this.datasource = datasource;
      return this.refreshData(this.datasource);
    }).then(() => {
      this.loading = false;
    }).catch(err => {
      console.log('Panel data error:', err);
      this.loading = false;
      this.error = err.message || "Timeseries data request error";
      this.inspector = {error: err};
    });
  }

  setTimeQueryStart() {
    this.timing = {};
    this.timing.queryStart = new Date().getTime();
  }

  setTimeQueryEnd() {
    this.timing.queryEnd = new Date().getTime();
  }

  updateTimeRange() {
    this.range = this.timeSrv.timeRange();
    this.rangeRaw = this.timeSrv.timeRange(false);

    this.applyPanelTimeOverrides();

    if (this.panel.maxDataPoints) {
      this.resolution = this.panel.maxDataPoints;
    } else {
      this.resolution = Math.ceil($(window).width() * (this.panel.span / 12));
    }

    var panelInterval = this.panel.interval;
    var datasourceInterval = (this.datasource || {}).interval;
    this.interval = kbn.calculateInterval(this.range, this.resolution, panelInterval || datasourceInterval);
  };

  applyPanelTimeOverrides() {
    this.timeInfo = '';

    // check panel time overrrides
    if (this.panel.timeFrom) {
      var timeFromInfo = rangeUtil.describeTextRange(this.panel.timeFrom);
      if (timeFromInfo.invalid) {
        this.timeInfo = 'invalid time override';
        return;
      }

      if (_.isString(this.rangeRaw.from)) {
        var timeFromDate = dateMath.parse(timeFromInfo.from);
        this.timeInfo = timeFromInfo.display;
        this.rangeRaw.from = timeFromInfo.from;
        this.rangeRaw.to = timeFromInfo.to;
        this.range.from = timeFromDate;
        this.range.to = dateMath.parse(timeFromInfo.to);
      }
    }

    if (this.panel.timeShift) {
      var timeShiftInfo = rangeUtil.describeTextRange(this.panel.timeShift);
      if (timeShiftInfo.invalid) {
        this.timeInfo = 'invalid timeshift';
        return;
      }

      var timeShift = '-' + this.panel.timeShift;
      this.timeInfo += ' timeshift ' + timeShift;
      this.range.from = dateMath.parseDateMath(timeShift, this.range.from, false);
      this.range.to = dateMath.parseDateMath(timeShift, this.range.to, true);

      this.rangeRaw = this.range;
    }

    if (this.panel.hideTimeOverride) {
      this.timeInfo = '';
    }
  };

  issueQueries(datasource) {
    this.updateTimeRange();

    if (!this.panel.targets || this.panel.targets.length === 0) {
      return this.$q.when([]);
    }

    var metricsQuery = {
      range: this.range,
      rangeRaw: this.rangeRaw,
      interval: this.interval,
      targets: this.panel.targets,
      format: this.panel.renderer === 'png' ? 'png' : 'json',
      maxDataPoints: this.resolution,
      scopedVars: this.panel.scopedVars,
      cacheTimeout: this.panel.cacheTimeout
    };

    this.setTimeQueryStart();
    try {
      return datasource.query(metricsQuery).then(results => {
        this.setTimeQueryEnd();

        if (this.dashboard.snapshot) {
          this.panel.snapshotData = results;
        }

        return results;
      });
    } catch (err) {
      return this.$q.reject(err);
    }
  }

  setDatasource(datasource) {
    // switching to mixed
    if (datasource.meta.mixed) {
      _.each(this.panel.targets, target => {
        target.datasource = this.panel.datasource;
        if (target.datasource === null) {
          target.datasource = config.defaultDatasource;
        }
      });
    } else if (this.datasource && this.datasource.meta.mixed) {
      _.each(this.panel.targets, target => {
        delete target.datasource;
      });
    }

    this.panel.datasource = datasource.value;
    this.datasource = null;
    this.refresh();
  }

  addDataQuery(datasource) {
    var target = {
      datasource: datasource ? datasource.name : undefined
    };
    this.panel.targets.push(target);
  }
}

export {MetricsPanelCtrl};
