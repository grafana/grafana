// Libraries
import _ from 'lodash';
// Utils
import kbn from 'app/core/utils/kbn';
import coreModule from 'app/core/core_module';
// Types
import {
  dateMath,
  DefaultTimeRange,
  TimeRange,
  RawTimeRange,
  TimeZone,
  toUtc,
  dateTime,
  isDateTime,
} from '@grafana/data';
import { ITimeoutService, ILocationService } from 'angular';
import { ContextSrv } from 'app/core/services/context_srv';
import { DashboardModel } from '../state/DashboardModel';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { getZoomedTimeRange, getShiftedTimeRange } from 'app/core/utils/timePicker';
import { appEvents } from '../../../core/core';
import { CoreEvents } from '../../../types';

import { config } from 'app/core/config';

export class TimeSrv {
  time: any;
  refreshTimer: any;
  refresh: any;
  oldRefresh: boolean;
  dashboard: Partial<DashboardModel>;
  timeAtLoad: any;
  private autoRefreshBlocked: boolean;

  /** @ngInject */
  constructor(
    $rootScope: GrafanaRootScope,
    private $timeout: ITimeoutService,
    private $location: ILocationService,
    private timer: any,
    private contextSrv: ContextSrv
  ) {
    // default time
    this.time = DefaultTimeRange.raw;

    appEvents.on(CoreEvents.zoomOut, this.zoomOut.bind(this));
    appEvents.on(CoreEvents.shiftTime, this.shiftTime.bind(this));
    $rootScope.$on('$routeUpdate', this.routeUpdated.bind(this));

    document.addEventListener('visibilitychange', () => {
      if (this.autoRefreshBlocked && document.visibilityState === 'visible') {
        this.autoRefreshBlocked = false;
        this.refreshDashboard();
      }
    });
  }

  init(dashboard: Partial<DashboardModel>) {
    this.timer.cancelAll();

    this.dashboard = dashboard;
    this.time = dashboard.time;
    this.refresh = dashboard.refresh;

    this.initTimeFromUrl();
    this.parseTime();

    // remember time at load so we can go back to it
    this.timeAtLoad = _.cloneDeep(this.time);

    if (this.refresh) {
      this.setAutoRefresh(this.refresh);
    }
  }

  getValidIntervals(intervals: string[]): string[] {
    if (!this.contextSrv.minRefreshInterval) {
      return intervals;
    }

    const validIntervals = intervals.filter(str => str !== '').filter(this.contextSrv.isAllowedInterval);

    if (validIntervals.indexOf(this.contextSrv.minRefreshInterval) === -1) {
      validIntervals.unshift(this.contextSrv.minRefreshInterval);
    }
    return validIntervals;
  }

  private parseTime() {
    // when absolute time is saved in json it is turned to a string
    if (_.isString(this.time.from) && this.time.from.indexOf('Z') >= 0) {
      this.time.from = dateTime(this.time.from).utc();
    }
    if (_.isString(this.time.to) && this.time.to.indexOf('Z') >= 0) {
      this.time.to = dateTime(this.time.to).utc();
    }
  }

  private parseUrlParam(value: any) {
    if (value.indexOf('now') !== -1) {
      return value;
    }
    if (value.length === 8) {
      const utcValue = toUtc(value, 'YYYYMMDD');
      if (utcValue.isValid()) {
        return utcValue;
      }
    } else if (value.length === 15) {
      const utcValue = toUtc(value, 'YYYYMMDDTHHmmss');
      if (utcValue.isValid()) {
        return utcValue;
      }
    }

    if (!isNaN(value)) {
      const epoch = parseInt(value, 10);
      return toUtc(epoch);
    }

    return null;
  }

  private getTimeWindow(time: string, timeWindow: string) {
    const valueTime = parseInt(time, 10);
    let timeWindowMs;

    if (timeWindow.match(/^\d+$/) && parseInt(timeWindow, 10)) {
      // when time window specified in ms
      timeWindowMs = parseInt(timeWindow, 10);
    } else {
      timeWindowMs = kbn.interval_to_ms(timeWindow);
    }

    return {
      from: toUtc(valueTime - timeWindowMs / 2),
      to: toUtc(valueTime + timeWindowMs / 2),
    };
  }

  private initTimeFromUrl() {
    const params = this.$location.search();

    if (params.time && params['time.window']) {
      this.time = this.getTimeWindow(params.time, params['time.window']);
    }

    if (params.from) {
      this.time.from = this.parseUrlParam(params.from) || this.time.from;
    }
    if (params.to) {
      this.time.to = this.parseUrlParam(params.to) || this.time.to;
    }
    // if absolute ignore refresh option saved to dashboard
    if (params.to && params.to.indexOf('now') === -1) {
      this.refresh = false;
      this.dashboard.refresh = false;
    }
    // but if refresh explicitly set then use that
    if (params.refresh) {
      if (!this.contextSrv.isAllowedInterval(params.refresh)) {
        this.refresh = config.minRefreshInterval;
      } else {
        this.refresh = params.refresh || this.refresh;
      }
    }
  }

  private routeUpdated() {
    const params = this.$location.search();
    if (params.left) {
      return; // explore handles this;
    }
    const urlRange = this.timeRangeForUrl();
    // check if url has time range
    if (params.from && params.to) {
      // is it different from what our current time range?
      if (params.from !== urlRange.from || params.to !== urlRange.to) {
        // issue update
        this.initTimeFromUrl();
        this.setTime(this.time, true);
      }
    } else if (this.timeHasChangedSinceLoad()) {
      this.setTime(this.timeAtLoad, true);
    }
  }

  private timeHasChangedSinceLoad() {
    return this.timeAtLoad && (this.timeAtLoad.from !== this.time.from || this.timeAtLoad.to !== this.time.to);
  }

  setAutoRefresh(interval: any) {
    this.dashboard.refresh = interval;
    this.cancelNextRefresh();

    if (interval) {
      const validInterval = this.contextSrv.getValidInterval(interval);
      const intervalMs = kbn.interval_to_ms(validInterval);

      this.refreshTimer = this.timer.register(
        this.$timeout(() => {
          this.startNextRefreshTimer(intervalMs);
          this.refreshDashboard();
        }, intervalMs)
      );
    }

    // update url inside timeout to so that a digest happens after (called from react)
    this.$timeout(() => {
      const params = this.$location.search();
      if (interval) {
        params.refresh = this.contextSrv.getValidInterval(interval);
        this.$location.search(params);
      } else if (params.refresh) {
        delete params.refresh;
        this.$location.search(params);
      }
    });
  }

  refreshDashboard() {
    this.dashboard.timeRangeUpdated(this.timeRange());
  }

  private startNextRefreshTimer(afterMs: number) {
    this.cancelNextRefresh();
    this.refreshTimer = this.timer.register(
      this.$timeout(() => {
        this.startNextRefreshTimer(afterMs);
        if (this.contextSrv.isGrafanaVisible()) {
          this.refreshDashboard();
        } else {
          this.autoRefreshBlocked = true;
        }
      }, afterMs)
    );
  }

  private cancelNextRefresh() {
    this.timer.cancel(this.refreshTimer);
  }

  setTime(time: RawTimeRange, fromRouteUpdate?: boolean) {
    _.extend(this.time, time);

    // disable refresh if zoom in or zoom out
    if (isDateTime(time.to)) {
      this.oldRefresh = this.dashboard.refresh || this.oldRefresh;
      this.setAutoRefresh(false);
    } else if (this.oldRefresh && this.oldRefresh !== this.dashboard.refresh) {
      this.setAutoRefresh(this.oldRefresh);
      this.oldRefresh = null;
    }

    // update url
    if (fromRouteUpdate !== true) {
      const urlRange = this.timeRangeForUrl();
      const urlParams = this.$location.search();
      urlParams.from = urlRange.from;
      urlParams.to = urlRange.to;
      this.$location.search(urlParams);
    }

    this.$timeout(this.refreshDashboard.bind(this), 0);
  }

  timeRangeForUrl() {
    const range = this.timeRange().raw;

    if (isDateTime(range.from)) {
      range.from = range.from.valueOf().toString();
    }
    if (isDateTime(range.to)) {
      range.to = range.to.valueOf().toString();
    }

    return range;
  }

  timeRange(): TimeRange {
    // make copies if they are moment  (do not want to return out internal moment, because they are mutable!)
    const raw = {
      from: isDateTime(this.time.from) ? dateTime(this.time.from) : this.time.from,
      to: isDateTime(this.time.to) ? dateTime(this.time.to) : this.time.to,
    };

    const timezone: TimeZone = this.dashboard ? this.dashboard.getTimezone() : undefined;

    return {
      from: dateMath.parse(raw.from, false, timezone),
      to: dateMath.parse(raw.to, true, timezone),
      raw: raw,
    };
  }

  zoomOut(factor: number) {
    const range = this.timeRange();
    const { from, to } = getZoomedTimeRange(range, factor);

    this.setTime({ from: toUtc(from), to: toUtc(to) });
  }

  shiftTime(direction: number) {
    const range = this.timeRange();
    const { from, to } = getShiftedTimeRange(direction, range);

    this.setTime({
      from: toUtc(from),
      to: toUtc(to),
    });
  }
}

let singleton: TimeSrv;

export function setTimeSrv(srv: TimeSrv) {
  singleton = srv;
}

export function getTimeSrv(): TimeSrv {
  return singleton;
}

coreModule.service('timeSrv', TimeSrv);
