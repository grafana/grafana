import { __makeTemplateObject } from "tslib";
import { getRefreshFromUrl } from './getRefreshFromUrl';
describe('getRefreshFromUrl', function () {
    describe('when refresh is not part of params', function () {
        it('then it should return current refresh value', function () {
            var params = {};
            var currentRefresh = false;
            var minRefreshInterval = '5s';
            var isAllowedIntervalFn = function () { return false; };
            var actual = getRefreshFromUrl({
                params: params,
                currentRefresh: currentRefresh,
                minRefreshInterval: minRefreshInterval,
                isAllowedIntervalFn: isAllowedIntervalFn,
            });
            expect(actual).toBe(false);
        });
    });
    describe('when refresh is part of params', function () {
        describe('and refresh is an existing and valid interval', function () {
            it('then it should return the refresh value', function () {
                var params = { refresh: '10s' };
                var currentRefresh = '';
                var minRefreshInterval = '5s';
                var isAllowedIntervalFn = function () { return true; };
                var refreshIntervals = ['5s', '10s', '30s'];
                var actual = getRefreshFromUrl({
                    params: params,
                    currentRefresh: currentRefresh,
                    minRefreshInterval: minRefreshInterval,
                    isAllowedIntervalFn: isAllowedIntervalFn,
                    refreshIntervals: refreshIntervals,
                });
                expect(actual).toBe('10s');
            });
        });
        it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      refresh | isAllowedInterval | minRefreshInterval | refreshIntervals              | expected\n      ", " | ", "           | ", "            | ", " | ", "\n      ", " | ", "           | ", "           | ", "       | ", "\n      ", " | ", "           | ", "            | ", "       | ", "\n      ", " | ", "           | ", "            | ", "                  | ", "\n      ", " | ", "           | ", "           | ", "                  | ", "\n      ", " | ", "           | ", "            | ", "                         | ", "\n      ", " | ", "           | ", "           | ", "                         | ", "\n      ", " | ", "          | ", "            | ", " | ", "\n      ", " | ", "          | ", "           | ", " | ", "\n      ", " | ", "          | ", "            | ", "       | ", "\n      ", " | ", "          | ", "           | ", "       | ", "\n      ", " | ", "          | ", "            | ", "                  | ", "\n      ", " | ", "          | ", "           | ", "                  | ", "\n      ", " | ", "          | ", "            | ", "                         | ", "\n      ", " | ", "          | ", "           | ", "                         | ", "\n    "], ["\n      refresh | isAllowedInterval | minRefreshInterval | refreshIntervals              | expected\n      ", " | ", "           | ", "            | ", " | ", "\n      ", " | ", "           | ", "           | ", "       | ", "\n      ", " | ", "           | ", "            | ", "       | ", "\n      ", " | ", "           | ", "            | ", "                  | ", "\n      ", " | ", "           | ", "           | ", "                  | ", "\n      ", " | ", "           | ", "            | ", "                         | ", "\n      ", " | ", "           | ", "           | ", "                         | ", "\n      ", " | ", "          | ", "            | ", " | ", "\n      ", " | ", "          | ", "           | ", " | ", "\n      ", " | ", "          | ", "            | ", "       | ", "\n      ", " | ", "          | ", "           | ", "       | ", "\n      ", " | ", "          | ", "            | ", "                  | ", "\n      ", " | ", "          | ", "           | ", "                  | ", "\n      ", " | ", "          | ", "            | ", "                         | ", "\n      ", " | ", "          | ", "           | ", "                         | ", "\n    "])), '6s', true, '1s', ['5s', '6s', '10s', '30s'], '6s', '6s', true, '10s', ['5s', '10s', '30s'], '10s', '6s', true, '1s', ['5s', '10s', '30s'], '5s', '6s', true, '1s', undefined, '5s', '6s', true, '10s', undefined, '10s', '6s', true, '1s', [], 'currentRefresh', '6s', true, '10s', [], 'currentRefresh', '6s', false, '1s', ['5s', '6s', '10s', '30s'], '5s', '6s', false, '10s', ['5s', '6s', '10s', '30s'], '10s', '6s', false, '1s', ['5s', '10s', '30s'], '5s', '6s', false, '10s', ['5s', '10s', '30s'], '10s', '6s', false, '1s', undefined, '5s', '6s', false, '10s', undefined, '10s', '6s', false, '1s', [], 'currentRefresh', '6s', false, '10s', [], 'currentRefresh')('when called with refresh:{$refresh}, isAllowedInterval:{$isAllowedInterval}, minRefreshInterval:{$minRefreshInterval}, refreshIntervals:{$refreshIntervals} then it should return: $expected', function (_a) {
            var refresh = _a.refresh, isAllowedInterval = _a.isAllowedInterval, minRefreshInterval = _a.minRefreshInterval, refreshIntervals = _a.refreshIntervals, expected = _a.expected;
            var actual = getRefreshFromUrl({
                params: { refresh: refresh },
                currentRefresh: 'currentRefresh',
                minRefreshInterval: minRefreshInterval,
                isAllowedIntervalFn: function () { return isAllowedInterval; },
                refreshIntervals: refreshIntervals,
            });
            expect(actual).toBe(expected);
        });
    });
});
var templateObject_1;
//# sourceMappingURL=getRefreshFromUrl.test.js.map