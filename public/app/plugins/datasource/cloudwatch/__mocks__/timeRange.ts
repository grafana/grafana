import { dateTime, TimeRange } from '@grafana/data';

const start = 1483196400 * 1000;
const from = dateTime(start);
const to = dateTime(start + 3600 * 1000);
export const timeRange: TimeRange = { from, to, raw: { from, to } };
