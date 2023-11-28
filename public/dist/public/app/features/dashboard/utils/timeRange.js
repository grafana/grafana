import { dateMath, dateTime, isDateTime } from '@grafana/data/src';
export const getTimeRange = (time, timeModel) => {
    // make copies if they are moment  (do not want to return out internal moment, because they are mutable!)
    const raw = {
        from: isDateTime(time.from) ? dateTime(time.from) : time.from,
        to: isDateTime(time.to) ? dateTime(time.to) : time.to,
    };
    const timezone = timeModel ? timeModel.getTimezone() : undefined;
    return {
        from: dateMath.parse(raw.from, false, timezone, timeModel === null || timeModel === void 0 ? void 0 : timeModel.fiscalYearStartMonth),
        to: dateMath.parse(raw.to, true, timezone, timeModel === null || timeModel === void 0 ? void 0 : timeModel.fiscalYearStartMonth),
        raw: raw,
    };
};
//# sourceMappingURL=timeRange.js.map