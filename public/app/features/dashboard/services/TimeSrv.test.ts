import * as H from 'history';
import { ContextSrvStub } from 'test/specs/helpers';

import { dateTime, isDateTime } from '@grafana/data';
import { config, HistoryWrapper, locationService, setLocationService } from '@grafana/runtime';
import { EmbeddedScene, SceneCanvasText, SceneTimeRange } from '@grafana/scenes';

import { TimeModel } from '../state/TimeModel';

import { TimeSrv } from './TimeSrv';

jest.mock('app/core/core', () => ({
  appEvents: {
    subscribe: () => {},
  },
}));

describe('timeSrv', () => {
  let timeSrv: TimeSrv;
  let _dashboard: TimeModel;
  let locationUpdates: H.Location[] = [];

  beforeEach(() => {
    _dashboard = {
      time: { from: 'now-6h', to: 'now' },
      getTimezone: jest.fn(() => 'browser'),
      refresh: '',
      timeRangeUpdated: jest.fn(() => {}),
      timepicker: {},
    };

    timeSrv = new TimeSrv(new ContextSrvStub());
    timeSrv.init(_dashboard);

    locationUpdates = [];
    const history = new HistoryWrapper();
    history.getHistory().listen((x) => locationUpdates.push(x));
    setLocationService(history);
  });

  describe('timeRange', () => {
    it('should return unparsed when parse is false', () => {
      timeSrv.setTime({ from: 'now', to: 'now-1h' });
      const time = timeSrv.timeRange();
      expect(time.raw.from).toBe('now');
      expect(time.raw.to).toBe('now-1h');
    });

    it('should return parsed when parse is true', () => {
      timeSrv.setTime({ from: 'now', to: 'now-1h' });
      const time = timeSrv.timeRange();
      expect(isDateTime(time.from)).toBe(true);
      expect(isDateTime(time.to)).toBe(true);
    });
  });

  describe('init time from url', () => {
    it('should handle relative times', () => {
      locationService.push('/d/id?from=now-2d&to=now');

      timeSrv = new TimeSrv(new ContextSrvStub());

      timeSrv.init(_dashboard);
      const time = timeSrv.timeRange();
      expect(time.raw.from).toBe('now-2d');
      expect(time.raw.to).toBe('now');
    });

    it('should handle formatted dates', () => {
      locationService.push('/d/id?from=20140410T052010&to=20140520T031022');

      timeSrv = new TimeSrv(new ContextSrvStub());

      timeSrv.init(_dashboard);
      const time = timeSrv.timeRange();
      expect(time.from.valueOf()).toEqual(new Date('2014-04-10T05:20:10Z').getTime());
      expect(time.to.valueOf()).toEqual(new Date('2014-05-20T03:10:22Z').getTime());
    });

    it('should ignore refresh if time absolute', () => {
      locationService.push('/d/id?from=20140410T052010&to=20140520T031022');

      timeSrv = new TimeSrv(new ContextSrvStub());

      // dashboard saved with refresh on
      _dashboard.refresh = '10s';
      timeSrv.init(_dashboard);

      expect(timeSrv.refresh).toBe(false);
    });

    describe('public dashboard', () => {
      beforeEach(() => {
        _dashboard = {
          time: { from: 'now-6h', to: 'now' },
          getTimezone: jest.fn(() => 'browser'),
          refresh: '',
          timeRangeUpdated: jest.fn(() => {}),
          timepicker: {},
        };

        locationService.push('/d/id?from=now-24h&to=now');
        config.publicDashboardAccessToken = 'abc123';
        timeSrv = new TimeSrv(new ContextSrvStub());
      });

      it("should ignore from and to if it's a public dashboard and time picker is hidden", () => {
        timeSrv.init({ ..._dashboard, timepicker: { hidden: true } });
        const time = timeSrv.timeRange();

        expect(time.raw.from).toBe('now-6h');
        expect(time.raw.to).toBe('now');
      });

      it("should not ignore from and to if it's a public dashboard but time picker is not hidden", () => {
        timeSrv.init({ ..._dashboard, timepicker: { hidden: false } });
        const time = timeSrv.timeRange();

        expect(time.raw.from).toBe('now-24h');
        expect(time.raw.to).toBe('now');
      });
    });

    it('should handle formatted dates without time', () => {
      locationService.push('/d/id?from=20140410&to=20140520');

      timeSrv = new TimeSrv(new ContextSrvStub());

      timeSrv.init(_dashboard);
      const time = timeSrv.timeRange();
      expect(time.from.valueOf()).toEqual(new Date('2014-04-10T00:00:00Z').getTime());
      expect(time.to.valueOf()).toEqual(new Date('2014-05-20T00:00:00Z').getTime());
    });

    it('should handle epochs', () => {
      locationService.push('/d/id?from=1410337646373&to=1410337665699');

      timeSrv = new TimeSrv(new ContextSrvStub());

      timeSrv.init(_dashboard);
      const time = timeSrv.timeRange();
      expect(time.from.valueOf()).toEqual(1410337646373);
      expect(time.to.valueOf()).toEqual(1410337665699);
    });

    it('should handle epochs that look like formatted date without time', () => {
      locationService.push('/d/id?from=20149999&to=20159999');

      timeSrv = new TimeSrv(new ContextSrvStub());

      timeSrv.init(_dashboard);
      const time = timeSrv.timeRange();
      expect(time.from.valueOf()).toEqual(20149999);
      expect(time.to.valueOf()).toEqual(20159999);
    });

    it('should handle epochs that look like formatted date', () => {
      locationService.push('/d/id?from=201499991234567&to=201599991234567');

      timeSrv = new TimeSrv(new ContextSrvStub());

      timeSrv.init(_dashboard);
      const time = timeSrv.timeRange();
      expect(time.from.valueOf()).toEqual(201499991234567);
      expect(time.to.valueOf()).toEqual(201599991234567);
    });

    it('should handle bad dates', () => {
      locationService.push('/d/id?from=20151126T00010%3C%2Fp%3E%3Cspan%20class&to=now');

      timeSrv = new TimeSrv(new ContextSrvStub());

      _dashboard.time.from = 'now-6h';
      timeSrv.init(_dashboard);
      expect(timeSrv.time.from).toEqual('now-6h');
      expect(timeSrv.time.to).toEqual('now');
    });

    it('should handle refresh_intervals=null when refresh is enabled', () => {
      locationService.push('/d/id?refresh=30s');

      timeSrv = new TimeSrv(new ContextSrvStub());

      _dashboard.timepicker = {
        refresh_intervals: null,
      };
      expect(() => timeSrv.init(_dashboard)).not.toThrow();
    });

    describe('data point windowing', () => {
      it('handles time window specfied as interval string', () => {
        locationService.push('/d/id?time=1410337645000&time.window=10s');

        timeSrv = new TimeSrv(new ContextSrvStub());

        timeSrv.init(_dashboard);
        const time = timeSrv.timeRange();
        expect(time.from.valueOf()).toEqual(1410337640000);
        expect(time.to.valueOf()).toEqual(1410337650000);
      });

      it('handles time window specified in ms', () => {
        locationService.push('/d/id?time=1410337645000&time.window=10000');

        timeSrv = new TimeSrv(new ContextSrvStub());

        timeSrv.init(_dashboard);
        const time = timeSrv.timeRange();
        expect(time.from.valueOf()).toEqual(1410337640000);
        expect(time.to.valueOf()).toEqual(1410337650000);
      });

      it('does not correct inverted from/to dates in ms', () => {
        locationService.push('/d/id?from=1621436828909&to=1621436818909');

        timeSrv = new TimeSrv(new ContextSrvStub());

        timeSrv.init(_dashboard);
        const time = timeSrv.timeRange();
        expect(time.from.valueOf()).toEqual(1621436828909);
        expect(time.to.valueOf()).toEqual(1621436818909);
      });

      it('does not correct inverted from/to dates as relative times', () => {
        locationService.push('/d/id?from=now&to=now-1h');

        timeSrv = new TimeSrv(new ContextSrvStub());

        timeSrv.init(_dashboard);
        const time = timeSrv.timeRange();
        expect(time.raw.from).toBe('now');
        expect(time.raw.to).toBe('now-1h');
      });

      it('should correctly handle timezones', () => {
        locationService.push('/d/id?from=1718797457286&to=1718819057286');
        _dashboard = {
          time: { from: '1718797457286', to: '1718819057286' },
          getTimezone: jest.fn(() => 'Africa/Cairo'),
          refresh: '',
          timeRangeUpdated: jest.fn(() => {}),
          timepicker: {},
        };

        timeSrv = new TimeSrv(new ContextSrvStub());
        timeSrv.init(_dashboard);

        const time = timeSrv.timeRange();
        expect(time.from.toString()).toBe('Wed Jun 19 2024 14:44:17 GMT+0300');
        expect(time.to.toString()).toBe('Wed Jun 19 2024 20:44:17 GMT+0300');
      });
    });
  });

  describe('setTime', () => {
    it('should return disable refresh if refresh is disabled for any range', () => {
      _dashboard.refresh = '';

      timeSrv.setTime({ from: '2011-01-01', to: '2015-01-01' });
      expect(_dashboard.refresh).toBe('');
    });

    it('should restore refresh for absolute time range', () => {
      _dashboard.refresh = '30s';

      timeSrv.setTime({ from: '2011-01-01', to: '2015-01-01' });
      expect(_dashboard.refresh).toBe('30s');
    });

    it('should restore refresh after relative time range is set', () => {
      _dashboard.refresh = '10s';
      timeSrv.setTime({
        from: dateTime([2011, 1, 1]),
        to: dateTime([2015, 1, 1]),
      });
      expect(_dashboard.refresh).toBe('');
      timeSrv.setTime({ from: '2011-01-01', to: 'now' });
      expect(_dashboard.refresh).toBe('10s');
    });

    it('should keep refresh after relative time range is changed and now delay exists', () => {
      _dashboard.refresh = '10s';
      timeSrv.setTime({ from: 'now-1h', to: 'now-10s' });
      expect(_dashboard.refresh).toBe('10s');
    });

    it('should update location only once for consecutive calls with the same range', () => {
      timeSrv.setTime({ from: 'now-1h', to: 'now-10s' });
      timeSrv.setTime({ from: 'now-1h', to: 'now-10s' });

      expect(locationUpdates.length).toBe(1);
    });

    it('should update location so that bool params are preserved', () => {
      locationService.partial({ kiosk: true });

      timeSrv.setTime({ from: 'now-1h', to: 'now-10s' });
      timeSrv.setTime({ from: 'now-1h', to: 'now-10s' });

      expect(locationUpdates[1].search).toEqual('?kiosk&from=now-1h&to=now-10s');
    });

    it('should not change the URL if the updateUrl param is false', () => {
      timeSrv.setTime({ from: '1644340584281', to: '1644340584281' }, false);
      expect(locationUpdates.length).toBe(0);
    });
  });

  describe('resumeAutoRefresh', () => {
    it('should set auto-refresh interval', () => {
      timeSrv.setAutoRefresh('10s');
      expect(timeSrv.refreshTimer).not.toBeUndefined();

      timeSrv.stopAutoRefresh();
      expect(timeSrv.refreshTimer).toBeUndefined();

      timeSrv.resumeAutoRefresh();
      expect(timeSrv.refreshTimer).not.toBeUndefined();
    });

    it('should allow an auto refresh value', () => {
      timeSrv.setAutoRefresh('auto');
      expect(timeSrv.refreshTimer).not.toBeUndefined();
    });
  });

  describe('isRefreshOutsideThreshold', () => {
    const originalNow = Date.now;

    beforeEach(() => {
      Date.now = jest.fn(() => 60000);
    });

    afterEach(() => {
      Date.now = originalNow;
    });

    describe('when called and current time range is absolute', () => {
      it('then it should return false', () => {
        timeSrv.setTime({ from: dateTime(), to: dateTime() });

        expect(timeSrv.isRefreshOutsideThreshold(0, 0.05)).toBe(false);
      });
    });

    describe('when called and current time range is relative', () => {
      describe('and last refresh is within threshold', () => {
        it('then it should return false', () => {
          timeSrv.setTime({ from: 'now-1m', to: 'now' });

          expect(timeSrv.isRefreshOutsideThreshold(57001, 0.05)).toBe(false);
        });
      });

      describe('and last refresh is outside the threshold', () => {
        it('then it should return true', () => {
          timeSrv.setTime({ from: 'now-1m', to: 'now' });

          expect(timeSrv.isRefreshOutsideThreshold(57000, 0.05)).toBe(true);
        });
      });
    });
  });

  describe('Scenes compatibility', () => {
    it('should use scene provided range if active', () => {
      timeSrv.setTime({ from: 'now-6h', to: 'now' });

      window.__grafanaSceneContext = new EmbeddedScene({
        $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
        body: new SceneCanvasText({ text: 'hello' }),
      });

      let time = timeSrv.timeRange();
      expect(time.raw.from).toBe('now-6h');
      expect(time.raw.to).toBe('now');

      window.__grafanaSceneContext.activate();
      time = timeSrv.timeRange();
      expect(time.raw.from).toBe('now-1h');
      expect(time.raw.to).toBe('now');
    });
  });
});
