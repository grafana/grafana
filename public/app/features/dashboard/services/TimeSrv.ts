import _ from 'lodash';
import { ITimeoutService } from 'angular';
import {
  dateMath,
  dateTime,
  getDefaultTimeRange,
  isDateTime,
  rangeUtil,
  RawTimeRange,
  TimeRange,
  toUtc,
} from '@grafana/data';

import coreModule from 'app/core/core_module';
import { ContextSrv } from 'app/core/services/context_srv';
import { DashboardModel } from '../state/DashboardModel';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';
import { appEvents } from '../../../core/core';
import { CoreEvents } from '../../../types';
import { config } from 'app/core/config';
import { getRefreshFromUrl } from '../utils/getRefreshFromUrl';
import { getLocationService, LocationService } from '@grafana/runtime';

interface TimeSrvDependencies {
  getLocationService: typeof getLocationService;
}

const runtimeDependencies: TimeSrvDependencies = {
  getLocationService,
};

export class TimeSrv {
  time: any;
  refreshTimer: any;
  refresh: any;
  oldRefresh: string | null | undefined;
  dashboard: DashboardModel;
  timeAtLoad: any;
  locationService: LocationService;
  private autoRefreshBlocked: boolean;

  /** @ngInject */
  constructor(
    $rootScope: GrafanaRootScope,
    private $timeout: ITimeoutService,
    private timer: any,
    private contextSrv: ContextSrv,
    private dependencies = runtimeDependencies
  ) {
    // default time
    this.time = getDefaultTimeRange().raw;
    this.locationService = dependencies.getLocationService();

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

  init(dashboard: DashboardModel) {
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

    return intervals.filter((str) => str !== '').filter(this.contextSrv.isAllowedInterval);
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
      timeWindowMs = rangeUtil.intervalToMs(timeWindow);
    }

    return {
      from: toUtc(valueTime - timeWindowMs / 2),
      to: toUtc(valueTime + timeWindowMs / 2),
    };
  }

  private initTimeFromUrl() {
    const params = this.locationService.getSearch();

    if (params.get('time') && params.get('time.window')) {
      this.time = this.getTimeWindow(params.get('time')!, params.get('time.window')!);
    }

    if (params.get('from')) {
      this.time.from = this.parseUrlParam(params.get('from')!) || this.time.from;
    }

    if (params.get('to')) {
      this.time.to = this.parseUrlParam(params.get('to')!) || this.time.to;
    }

    // if absolute ignore refresh option saved to dashboard
    if (params.get('to') && params.get('to')!.indexOf('now') === -1) {
      this.refresh = false;
      this.dashboard.refresh = false;
    }

    let paramsJSON: Record<string, string> = {};
    params.forEach(function (value, key) {
      paramsJSON[key] = value;
    });

    // but if refresh explicitly set then use that
    this.refresh = getRefreshFromUrl({
      params: paramsJSON,
      currentRefresh: this.refresh,
      refreshIntervals: this.dashboard?.timepicker?.refresh_intervals,
      isAllowedIntervalFn: this.contextSrv.isAllowedInterval,
      minRefreshInterval: config.minRefreshInterval,
    });
  }

  private routeUpdated() {
    const params = this.locationService.getSearch();

    if (params.get('left')) {
      return; // explore handles this;
    }

    const urlRange = this.timeRangeForUrl();
    const from = params.get('from');
    const to = params.get('to');

    // check if url has time range
    if (from && to) {
      // is it different from what our current time range?
      if (from !== urlRange.from || to !== urlRange.to) {
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
      const intervalMs = rangeUtil.intervalToMs(validInterval);

      this.refreshTimer = this.timer.register(
        this.$timeout(() => {
          this.startNextRefreshTimer(intervalMs);
          this.refreshDashboard();
        }, intervalMs)
      );
    }

    if (interval) {
      const refresh = this.contextSrv.getValidInterval(interval);
      this.locationService.partial({ refresh }, true);
    } else {
      this.locationService.partial({ refresh: null }, true);
    }
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
      const urlParams = new URLSearchParams(this.dependencies.getLocationService().getCurrentLocation().search);

      urlParams.set('from', urlRange.from.toString());
      urlParams.set('to', urlRange.to.toString());

      this.dependencies.getLocationService().push({
        ...this.dependencies.getLocationService().getCurrentLocation(),
        search: urlParams.toString(),
      });
    }

    this.$timeout(this.refreshDashboard.bind(this), 0);
  }

  timeRangeForUrl = () => {
    const range = this.timeRange().raw;

    if (isDateTime(range.from)) {
      range.from = range.from.valueOf().toString();
    }
    if (isDateTime(range.to)) {
      range.to = range.to.valueOf().toString();
    }

    return range;
  };

  timeRange(): TimeRange {
    // make copies if they are moment  (do not want to return out internal moment, because they are mutable!)
    const raw = {
      from: isDateTime(this.time.from) ? dateTime(this.time.from) : this.time.from,
      to: isDateTime(this.time.to) ? dateTime(this.time.to) : this.time.to,
    };

    const timezone = this.dashboard ? this.dashboard.getTimezone() : undefined;

    return {
      from: dateMath.parse(raw.from, false, timezone)!,
      to: dateMath.parse(raw.to, true, timezone)!,
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
