import moment from 'moment';
import _ from 'lodash';
import coreModule from 'app/core/core_module';
import kbn from 'app/core/utils/kbn';
import * as dateMath from 'app/core/utils/datemath';

export class TimeSrv {
  time: any;
  refreshTimer: any;
  refresh: boolean;
  oldRefresh: boolean;
  dashboard: any;
  timeAtLoad: any;
  private autoRefreshBlocked: boolean;

  /** @ngInject **/
  constructor(private $rootScope, private $timeout, private $location, private timer, private contextSrv) {
    // default time
    this.time = { from: '6h', to: 'now' };

    $rootScope.$on('zoom-out', this.zoomOut.bind(this));
    $rootScope.$on('$routeUpdate', this.routeUpdated.bind(this));

    document.addEventListener('visibilitychange', () => {
      if (this.autoRefreshBlocked && document.visibilityState === 'visible') {
        this.autoRefreshBlocked = false;

        this.refreshDashboard();
      }
    });
  }

  init(dashboard) {
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

  private parseTime() {
    // when absolute time is saved in json it is turned to a string
    if (_.isString(this.time.from) && this.time.from.indexOf('Z') >= 0) {
      this.time.from = moment(this.time.from).utc();
    }
    if (_.isString(this.time.to) && this.time.to.indexOf('Z') >= 0) {
      this.time.to = moment(this.time.to).utc();
    }
  }

  private parseUrlParam(value) {
    if (value.indexOf('now') !== -1) {
      return value;
    }
    if (value.length === 8) {
      return moment.utc(value, 'YYYYMMDD');
    }
    if (value.length === 15) {
      return moment.utc(value, 'YYYYMMDDTHHmmss');
    }

    if (!isNaN(value)) {
      var epoch = parseInt(value);
      return moment.utc(epoch);
    }

    return null;
  }

  private initTimeFromUrl() {
    var params = this.$location.search();
    if (params.from) {
      this.time.from = this.parseUrlParam(params.from) || this.time.from;
    }
    if (params.to) {
      this.time.to = this.parseUrlParam(params.to) || this.time.to;
    }
    if (params.refresh) {
      this.refresh = params.refresh || this.refresh;
    }
  }

  private routeUpdated() {
    var params = this.$location.search();
    var urlRange = this.timeRangeForUrl();
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
    return this.timeAtLoad.from !== this.time.from || this.timeAtLoad.to !== this.time.to;
  }

  setAutoRefresh(interval) {
    this.dashboard.refresh = interval;
    this.cancelNextRefresh();
    if (interval) {
      var intervalMs = kbn.interval_to_ms(interval);

      this.refreshTimer = this.timer.register(
        this.$timeout(() => {
          this.startNextRefreshTimer(intervalMs);
          this.refreshDashboard();
        }, intervalMs)
      );
    }

    // update url
    var params = this.$location.search();
    if (interval) {
      params.refresh = interval;
      this.$location.search(params);
    } else if (params.refresh) {
      delete params.refresh;
      this.$location.search(params);
    }
  }

  refreshDashboard() {
    this.$rootScope.$broadcast('refresh');
  }

  private startNextRefreshTimer(afterMs) {
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

  setTime(time, fromRouteUpdate?) {
    _.extend(this.time, time);

    // disable refresh if zoom in or zoom out
    if (moment.isMoment(time.to)) {
      this.oldRefresh = this.dashboard.refresh || this.oldRefresh;
      this.setAutoRefresh(false);
    } else if (this.oldRefresh && this.oldRefresh !== this.dashboard.refresh) {
      this.setAutoRefresh(this.oldRefresh);
      this.oldRefresh = null;
    }

    // update url
    if (fromRouteUpdate !== true) {
      var urlRange = this.timeRangeForUrl();
      var urlParams = this.$location.search();
      urlParams.from = urlRange.from;
      urlParams.to = urlRange.to;
      this.$location.search(urlParams);
    }

    this.$rootScope.appEvent('time-range-changed', this.time);
    this.$timeout(this.refreshDashboard.bind(this), 0);
  }

  timeRangeForUrl() {
    var range = this.timeRange().raw;

    if (moment.isMoment(range.from)) {
      range.from = range.from.valueOf().toString();
    }
    if (moment.isMoment(range.to)) {
      range.to = range.to.valueOf().toString();
    }

    return range;
  }

  timeRange() {
    // make copies if they are moment  (do not want to return out internal moment, because they are mutable!)
    var raw = {
      from: moment.isMoment(this.time.from) ? moment(this.time.from) : this.time.from,
      to: moment.isMoment(this.time.to) ? moment(this.time.to) : this.time.to,
    };

    var timezone = this.dashboard && this.dashboard.getTimezone();

    return {
      from: dateMath.parse(raw.from, false, timezone),
      to: dateMath.parse(raw.to, true, timezone),
      raw: raw,
    };
  }

  zoomOut(e, factor) {
    var range = this.timeRange();

    var timespan = range.to.valueOf() - range.from.valueOf();
    var center = range.to.valueOf() - timespan / 2;

    var to = center + timespan * factor / 2;
    var from = center - timespan * factor / 2;

    if (to > Date.now() && range.to <= Date.now()) {
      var offset = to - Date.now();
      from = from - offset;
      to = Date.now();
    }

    this.setTime({ from: moment.utc(from), to: moment.utc(to) });
  }
}

coreModule.service('timeSrv', TimeSrv);
