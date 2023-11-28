import { defaultIntervals } from '@grafana/ui';
// getRefreshFromUrl function returns the value from the supplied &refresh= param in url.
// If the supplied interval is not allowed or does not exist in the refresh intervals for the dashboard then we
// try to find the first refresh interval that matches the minRefreshInterval (min_refresh_interval in ini)
// or just take the first interval.
export function getRefreshFromUrl({ urlRefresh, currentRefresh, isAllowedIntervalFn, minRefreshInterval, refreshIntervals = defaultIntervals, }) {
    var _a;
    if (!urlRefresh) {
        return currentRefresh;
    }
    const isAllowedInterval = isAllowedIntervalFn(urlRefresh);
    const isExistingInterval = refreshIntervals.find((interval) => interval === urlRefresh);
    if (!isAllowedInterval || !isExistingInterval) {
        const minRefreshIntervalInIntervals = minRefreshInterval
            ? refreshIntervals.find((interval) => interval === minRefreshInterval)
            : undefined;
        const lowestRefreshInterval = (refreshIntervals === null || refreshIntervals === void 0 ? void 0 : refreshIntervals.length) ? refreshIntervals[0] : undefined;
        return (_a = minRefreshIntervalInIntervals !== null && minRefreshIntervalInIntervals !== void 0 ? minRefreshIntervalInIntervals : lowestRefreshInterval) !== null && _a !== void 0 ? _a : currentRefresh;
    }
    return urlRefresh || currentRefresh;
}
//# sourceMappingURL=getRefreshFromUrl.js.map