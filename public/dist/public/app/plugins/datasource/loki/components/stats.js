import { isDateTime } from '@grafana/data';
/**
 * This function compares two time values. If the first is absolute, it compares them using `DateTime.isSame`.
 *
 * @param {(DateTime | string)} time1
 * @param {(DateTime | string | undefined)} time2
 */
function compareTime(time1, time2) {
    if (!time1 || !time2) {
        return false;
    }
    const isAbsolute = isDateTime(time1);
    if (isAbsolute) {
        return time1.isSame(time2);
    }
    return time1 === time2;
}
export function shouldUpdateStats(query, prevQuery, timeRange, prevTimeRange, queryType, prevQueryType) {
    if (prevQuery === undefined || query.trim() !== prevQuery.trim() || queryType !== prevQueryType) {
        return true;
    }
    if (compareTime(timeRange === null || timeRange === void 0 ? void 0 : timeRange.raw.from, prevTimeRange === null || prevTimeRange === void 0 ? void 0 : prevTimeRange.raw.from) &&
        compareTime(timeRange === null || timeRange === void 0 ? void 0 : timeRange.raw.to, prevTimeRange === null || prevTimeRange === void 0 ? void 0 : prevTimeRange.raw.to)) {
        return false;
    }
    return true;
}
//# sourceMappingURL=stats.js.map