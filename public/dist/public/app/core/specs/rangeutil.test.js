import { rangeUtil, dateTime } from '@grafana/data';
describe('rangeUtil', function () {
    describe('Can get range text described', function () {
        it('should handle simple old expression with only amount and unit', function () {
            var info = rangeUtil.describeTextRange('5m');
            expect(info.display).toBe('Last 5 minutes');
        });
        it('should have singular when amount is 1', function () {
            var info = rangeUtil.describeTextRange('1h');
            expect(info.display).toBe('Last 1 hour');
        });
        it('should handle non default amount', function () {
            var info = rangeUtil.describeTextRange('13h');
            expect(info.display).toBe('Last 13 hours');
            expect(info.from).toBe('now-13h');
        });
        it('should handle non default future amount', function () {
            var info = rangeUtil.describeTextRange('+3h');
            expect(info.display).toBe('Next 3 hours');
            expect(info.from).toBe('now');
            expect(info.to).toBe('now+3h');
        });
        it('should handle now/d', function () {
            var info = rangeUtil.describeTextRange('now/d');
            expect(info.display).toBe('Today so far');
        });
        it('should handle now/w', function () {
            var info = rangeUtil.describeTextRange('now/w');
            expect(info.display).toBe('This week so far');
        });
        it('should handle now/M', function () {
            var info = rangeUtil.describeTextRange('now/M');
            expect(info.display).toBe('This month so far');
        });
        it('should handle now/y', function () {
            var info = rangeUtil.describeTextRange('now/y');
            expect(info.display).toBe('This year so far');
        });
    });
    describe('Can get date range described', function () {
        it('Date range with simple ranges', function () {
            var text = rangeUtil.describeTimeRange({ from: 'now-1h', to: 'now' });
            expect(text).toBe('Last 1 hour');
        });
        it('Date range with rounding ranges', function () {
            var text = rangeUtil.describeTimeRange({ from: 'now/d+6h', to: 'now' });
            expect(text).toBe('now/d+6h to now');
        });
        it('Date range with absolute to now', function () {
            var text = rangeUtil.describeTimeRange({
                from: dateTime([2014, 10, 10, 2, 3, 4]),
                to: 'now',
            });
            expect(text).toBe('2014-11-10 02:03:04 to a few seconds ago');
        });
        it('Date range with absolute to relative', function () {
            var text = rangeUtil.describeTimeRange({
                from: dateTime([2014, 10, 10, 2, 3, 4]),
                to: 'now-1d',
            });
            expect(text).toBe('2014-11-10 02:03:04 to a day ago');
        });
        it('Date range with relative to absolute', function () {
            var text = rangeUtil.describeTimeRange({
                from: 'now-7d',
                to: dateTime([2014, 10, 10, 2, 3, 4]),
            });
            expect(text).toBe('7 days ago to 2014-11-10 02:03:04');
        });
        it('Date range with non matching default ranges', function () {
            var text = rangeUtil.describeTimeRange({ from: 'now-13h', to: 'now' });
            expect(text).toBe('Last 13 hours');
        });
        it('Date range with from and to both are in now-* format', function () {
            var text = rangeUtil.describeTimeRange({ from: 'now-6h', to: 'now-3h' });
            expect(text).toBe('now-6h to now-3h');
        });
        it('Date range with from and to both are either in now-* or now/* format', function () {
            var text = rangeUtil.describeTimeRange({
                from: 'now/d+6h',
                to: 'now-3h',
            });
            expect(text).toBe('now/d+6h to now-3h');
        });
        it('Date range with from and to both are either in now-* or now+* format', function () {
            var text = rangeUtil.describeTimeRange({ from: 'now-6h', to: 'now+1h' });
            expect(text).toBe('now-6h to now+1h');
        });
    });
});
//# sourceMappingURL=rangeutil.test.js.map