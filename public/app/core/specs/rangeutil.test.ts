import * as rangeUtil from '@grafana/ui/src/utils/rangeutil';
import _ from 'lodash';
import { dateTime } from '@grafana/ui/src/utils/moment_wrapper';

describe('rangeUtil', () => {
  describe('Can get range grouped list of ranges', () => {
    it('when custom settings should return default range list', () => {
      const groups: any = rangeUtil.getRelativeTimesList({ time_options: [] }, 'Last 5 minutes');
      expect(_.keys(groups).length).toBe(4);
      expect(groups[3][0].active).toBe(true);
    });
  });

  describe('Can get range text described', () => {
    it('should handle simple old expression with only amount and unit', () => {
      const info = rangeUtil.describeTextRange('5m');
      expect(info.display).toBe('Last 5 minutes');
    });

    it('should have singular when amount is 1', () => {
      const info = rangeUtil.describeTextRange('1h');
      expect(info.display).toBe('Last 1 hour');
    });

    it('should handle non default amount', () => {
      const info = rangeUtil.describeTextRange('13h');
      expect(info.display).toBe('Last 13 hours');
      expect(info.from).toBe('now-13h');
    });

    it('should handle non default future amount', () => {
      const info = rangeUtil.describeTextRange('+3h');
      expect(info.display).toBe('Next 3 hours');
      expect(info.from).toBe('now');
      expect(info.to).toBe('now+3h');
    });

    it('should handle now/d', () => {
      const info = rangeUtil.describeTextRange('now/d');
      expect(info.display).toBe('Today so far');
    });

    it('should handle now/w', () => {
      const info = rangeUtil.describeTextRange('now/w');
      expect(info.display).toBe('This week so far');
    });

    it('should handle now/M', () => {
      const info = rangeUtil.describeTextRange('now/M');
      expect(info.display).toBe('This month so far');
    });

    it('should handle now/y', () => {
      const info = rangeUtil.describeTextRange('now/y');
      expect(info.display).toBe('This year so far');
    });
  });

  describe('Can get date range described', () => {
    it('Date range with simple ranges', () => {
      const text = rangeUtil.describeTimeRange({ from: 'now-1h', to: 'now' });
      expect(text).toBe('Last 1 hour');
    });

    it('Date range with rounding ranges', () => {
      const text = rangeUtil.describeTimeRange({ from: 'now/d+6h', to: 'now' });
      expect(text).toBe('now/d+6h to now');
    });

    it('Date range with absolute to now', () => {
      const text = rangeUtil.describeTimeRange({
        from: dateTime([2014, 10, 10, 2, 3, 4]),
        to: 'now',
      });
      expect(text).toBe('2014-11-10 02:03:04 to a few seconds ago');
    });

    it('Date range with absolute to relative', () => {
      const text = rangeUtil.describeTimeRange({
        from: dateTime([2014, 10, 10, 2, 3, 4]),
        to: 'now-1d',
      });
      expect(text).toBe('2014-11-10 02:03:04 to a day ago');
    });

    it('Date range with relative to absolute', () => {
      const text = rangeUtil.describeTimeRange({
        from: 'now-7d',
        to: dateTime([2014, 10, 10, 2, 3, 4]),
      });
      expect(text).toBe('7 days ago to 2014-11-10 02:03:04');
    });

    it('Date range with non matching default ranges', () => {
      const text = rangeUtil.describeTimeRange({ from: 'now-13h', to: 'now' });
      expect(text).toBe('Last 13 hours');
    });

    it('Date range with from and to both are in now-* format', () => {
      const text = rangeUtil.describeTimeRange({ from: 'now-6h', to: 'now-3h' });
      expect(text).toBe('now-6h to now-3h');
    });

    it('Date range with from and to both are either in now-* or now/* format', () => {
      const text = rangeUtil.describeTimeRange({
        from: 'now/d+6h',
        to: 'now-3h',
      });
      expect(text).toBe('now/d+6h to now-3h');
    });

    it('Date range with from and to both are either in now-* or now+* format', () => {
      const text = rangeUtil.describeTimeRange({ from: 'now-6h', to: 'now+1h' });
      expect(text).toBe('now-6h to now+1h');
    });
  });
});
