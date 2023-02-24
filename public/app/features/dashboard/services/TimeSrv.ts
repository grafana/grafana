import { cloneDeep, extend, isString } from 'lodash';

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
import { locationService } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { config } from 'app/core/config';
import { contextSrv, ContextSrv } from 'app/core/services/context_srv';
import { getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';
import { getTimeRange } from 'app/features/dashboard/utils/timeRange';

import { AbsoluteTimeEvent, ShiftTimeEvent, ShiftTimeEventDirection, ZoomOutEvent } from '../../../types/events';
import { TimeModel } from '../state/TimeModel';
import { getRefreshFromUrl } from '../utils/getRefreshFromUrl';

export class TimeSrv {
  time: any;
  refreshTimer: any;
  refresh: any;
  autoRefreshPaused = false;
  oldRefresh: string | null | undefined;
  timeModel?: TimeModel;
  timeAtLoad: any;
  private autoRefreshBlocked?: boolean;

  constructor(private contextSrv: ContextSrv) {
    // default time
    this.time = getDefaultTimeRange().raw;
    this.refreshTimeModel = this.refreshTimeModel.bind(this);

    appEvents.subscribe(ZoomOutEvent, (e) => {
      this.zoomOut(e.payload.scale, e.payload.updateUrl);
    });

    appEvents.subscribe(ShiftTimeEvent, (e) => {
      this.shiftTime(e.payload.direction, e.payload.updateUrl);
    });

    appEvents.subscribe(AbsoluteTimeEvent, () => {
      this.makeAbsoluteTime();
    });

    document.addEventListener('visibilitychange', () => {
      if (this.autoRefreshBlocked && document.visibilityState === 'visible') {
        this.autoRefreshBlocked = false;
        this.refreshTimeModel();
      }
    });
  }

  init(timeModel: TimeModel) {
    this.timeModel = timeModel;
    this.time = timeModel.time;
    this.refresh = timeModel.refresh;

    this.initTimeFromUrl();
    this.parseTime();

    // remember time at load so we can go back to it
    this.timeAtLoad = cloneDeep(this.time);

    const range = rangeUtil.convertRawToRange(
      this.time,
      this.timeModel?.getTimezone(),
      this.timeModel?.fiscalYearStartMonth
    );

    if (range.to.isBefore(range.from)) {
      this.setTime(
        {
          from: range.raw.to,
          to: range.raw.from,
        },
        false
      );
    }

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
    if (isString(this.time.from) && this.time.from.indexOf('Z') >= 0) {
      this.time.from = dateTime(this.time.from).utc();
    }
    if (isString(this.time.to) && this.time.to.indexOf('Z') >= 0) {
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
    if (config.isPublicDashboardView && this.timeModel?.timepicker?.hidden) {
      return;
    }

    const params = locationService.getSearch();

    if (params.get('time') && params.get('time.window')) {
      this.time = this.getTimeWindow(params.get('time')!, params.get('time.window')!);
    }

    if (params.get('from')) {
      this.time.from = this.parseUrlParam(params.get('from')!) || this.time.from;
    }

    if (params.get('to')) {
      this.time.to = this.parseUrlParam(params.get('to')!) || this.time.to;
    }

    // if absolute ignore refresh option saved to timeModel
    if (params.get('to') && params.get('to')!.indexOf('now') === -1) {
      this.refresh = false;
      if (this.timeModel) {
        this.timeModel.refresh = false;
      }
    }

    // but if refresh explicitly set then use that
    this.refresh = getRefreshFromUrl({
      urlRefresh: params.get('refresh'),
      currentRefresh: this.refresh,
      refreshIntervals: Array.isArray(this.timeModel?.timepicker?.refresh_intervals)
        ? this.timeModel?.timepicker?.refresh_intervals
        : undefined,
      isAllowedIntervalFn: this.contextSrv.isAllowedInterval,
      minRefreshInterval: config.minRefreshInterval,
    });
  }

  updateTimeRangeFromUrl() {
    const params = locationService.getSearch();

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
        this.setTime(this.time, false);
      }
    } else if (this.timeHasChangedSinceLoad()) {
      this.setTime(this.timeAtLoad, true);
    }
  }

  private timeHasChangedSinceLoad() {
    return this.timeAtLoad && (this.timeAtLoad.from !== this.time.from || this.timeAtLoad.to !== this.time.to);
  }

  setAutoRefresh(interval: any) {
    if (this.timeModel) {
      this.timeModel.refresh = interval;
    }

    this.stopAutoRefresh();

    const currentUrlState = locationService.getSearchObject();

    if (!interval) {
      // Clear URL state
      if (currentUrlState.refresh) {
        locationService.partial({ refresh: null }, true);
      }

      return;
    }

    const validInterval = this.contextSrv.getValidInterval(interval);
    const intervalMs = rangeUtil.intervalToMs(validInterval);

    this.refreshTimer = setTimeout(() => {
      this.startNextRefreshTimer(intervalMs);
      !this.autoRefreshPaused && this.refreshTimeModel();
    }, intervalMs);

    const refresh = this.contextSrv.getValidInterval(interval);

    if (currentUrlState.refresh !== refresh) {
      locationService.partial({ refresh }, true);
    }
  }

  refreshTimeModel() {
    this.timeModel?.timeRangeUpdated(this.timeRange());
  }

  private startNextRefreshTimer(afterMs: number) {
    this.refreshTimer = setTimeout(() => {
      this.startNextRefreshTimer(afterMs);
      if (this.contextSrv.isGrafanaVisible()) {
        !this.autoRefreshPaused && this.refreshTimeModel();
      } else {
        this.autoRefreshBlocked = true;
      }
    }, afterMs);
  }

  stopAutoRefresh() {
    clearTimeout(this.refreshTimer);
  }

  // store timeModel refresh value and pause auto-refresh in some places
  // i.e panel edit
  pauseAutoRefresh() {
    this.autoRefreshPaused = true;
  }

  // resume auto-refresh based on old dashboard refresh property
  resumeAutoRefresh() {
    this.autoRefreshPaused = false;
    this.refreshTimeModel();
  }

  setTime(time: RawTimeRange, updateUrl = true) {
    extend(this.time, time);

    // disable refresh if zoom in or zoom out
    if (isDateTime(time.to)) {
      this.oldRefresh = this.timeModel?.refresh || this.oldRefresh;
      this.setAutoRefresh(false);
    } else if (this.oldRefresh && this.oldRefresh !== this.timeModel?.refresh) {
      this.setAutoRefresh(this.oldRefresh);
      this.oldRefresh = null;
    }

    if (updateUrl === true) {
      const urlRange = this.timeRangeForUrl();
      const urlParams = locationService.getSearchObject();

      if (urlParams.from === urlRange.from.toString() && urlParams.to === urlRange.to.toString()) {
        return;
      }

      urlParams.from = urlRange.from.toString();
      urlParams.to = urlRange.to.toString();

      locationService.partial(urlParams);
    }

    this.refreshTimeModel();
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
    return getTimeRange(this.time, this.timeModel);
  }

  zoomOut(factor: number, updateUrl = true) {
    const range = this.timeRange();
    const { from, to } = getZoomedTimeRange(range, factor);

    this.setTime({ from: toUtc(from), to: toUtc(to) }, updateUrl);
  }

  shiftTime(direction: ShiftTimeEventDirection, updateUrl = true) {
    const range = this.timeRange();
    const { from, to } = getShiftedTimeRange(direction, range);

    this.setTime(
      {
        from: toUtc(from),
        to: toUtc(to),
      },
      updateUrl
    );
  }

  makeAbsoluteTime() {
    const params = locationService.getSearch();
    if (params.get('left')) {
      return; // explore handles this;
    }

    const { from, to } = this.timeRange();
    this.setTime({ from, to }, true);
  }

  // isRefreshOutsideThreshold function calculates the difference between last refresh and now
  // if the difference is outside 5% of the current set time range then the function will return true
  // if the difference is within 5% of the current set time range then the function will return false
  // if the current time range is absolute (i.e. not using relative strings like now-5m) then the function will return false
  isRefreshOutsideThreshold(lastRefresh: number, threshold = 0.05) {
    const timeRange = this.timeRange();

    if (dateMath.isMathString(timeRange.raw.from)) {
      const totalRange = timeRange.to.diff(timeRange.from);
      const msSinceLastRefresh = Date.now() - lastRefresh;
      const msThreshold = totalRange * threshold;
      return msSinceLastRefresh >= msThreshold;
    }

    return false;
  }
}

let singleton: TimeSrv | undefined;

export function setTimeSrv(srv: TimeSrv) {
  singleton = srv;
}

export function getTimeSrv(): TimeSrv {
  if (!singleton) {
    singleton = new TimeSrv(contextSrv);
  }

  return singleton;
}
