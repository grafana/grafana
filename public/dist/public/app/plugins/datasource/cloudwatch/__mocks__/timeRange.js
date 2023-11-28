import { dateTime } from '@grafana/data';
const start = 1483196400 * 1000;
const from = dateTime(start);
const to = dateTime(start + 3600 * 1000);
export const TimeRangeMock = { from, to, raw: { from, to } };
//# sourceMappingURL=timeRange.js.map