import { dateTime } from '@grafana/data/datetime';
import type { TimeRange } from '@grafana/data/types';

const start = 1483196400 * 1000;
const from = dateTime(start);
const to = dateTime(start + 3600 * 1000);
export const TimeRangeMock: TimeRange = { from, to, raw: { from, to } };
