import { defaultIntervals } from '@grafana/ui';
// getRefreshFromUrl function returns the value from the supplied &refresh= param in url.
// If the supplied interval is not allowed or does not exist in the refresh intervals for the dashboard then we
// try to find the first refresh interval that matches the minRefreshInterval (min_refresh_interval in ini)
// or just take the first interval.
export function getRefreshFromUrl(_a) {
    var _b;
    var params = _a.params, currentRefresh = _a.currentRefresh, isAllowedIntervalFn = _a.isAllowedIntervalFn, minRefreshInterval = _a.minRefreshInterval, _c = _a.refreshIntervals, refreshIntervals = _c === void 0 ? defaultIntervals : _c;
    if (!params.refresh) {
        return currentRefresh;
    }
    var isAllowedInterval = isAllowedIntervalFn(params.refresh);
    var isExistingInterval = refreshIntervals.find(function (interval) { return interval === params.refresh; });
    if (!isAllowedInterval || !isExistingInterval) {
        var minRefreshIntervalInIntervals = minRefreshInterval
            ? refreshIntervals.find(function (interval) { return interval === minRefreshInterval; })
            : undefined;
        var lowestRefreshInterval = (refreshIntervals === null || refreshIntervals === void 0 ? void 0 : refreshIntervals.length) ? refreshIntervals[0] : undefined;
        return (_b = minRefreshIntervalInIntervals !== null && minRefreshIntervalInIntervals !== void 0 ? minRefreshIntervalInIntervals : lowestRefreshInterval) !== null && _b !== void 0 ? _b : currentRefresh;
    }
    return params.refresh || currentRefresh;
}
//# sourceMappingURL=getRefreshFromUrl.js.map