import { toUtc } from '@grafana/data/datetime';
import { makeTimeRange } from '@grafana/data/types';

import { splitTimeRange, splitTimeRangeAligned } from './logsTimeSplitting';

describe('logs splitTimeRange', () => {
  it('should split time range into chunks', () => {
    const start = Date.parse('2022-02-06T14:10:03.234');
    const end = Date.parse('2022-02-06T14:11:03.567');

    expect(splitTimeRange(start, end, 10000)).toStrictEqual([
      [Date.parse('2022-02-06T14:10:03.234'), Date.parse('2022-02-06T14:10:03.567')],
      [Date.parse('2022-02-06T14:10:03.567'), Date.parse('2022-02-06T14:10:13.567')],
      [Date.parse('2022-02-06T14:10:13.567'), Date.parse('2022-02-06T14:10:23.567')],
      [Date.parse('2022-02-06T14:10:23.567'), Date.parse('2022-02-06T14:10:33.567')],
      [Date.parse('2022-02-06T14:10:33.567'), Date.parse('2022-02-06T14:10:43.567')],
      [Date.parse('2022-02-06T14:10:43.567'), Date.parse('2022-02-06T14:10:53.567')],
      [Date.parse('2022-02-06T14:10:53.567'), Date.parse('2022-02-06T14:11:03.567')],
    ]);
  });

  it('should split time range into chunks, when nicely aligned', () => {
    const start = Date.parse('2022-02-06T14:10:03.567');
    const end = Date.parse('2022-02-06T14:11:03.567');

    expect(splitTimeRange(start, end, 20000)).toStrictEqual([
      [Date.parse('2022-02-06T14:10:03.567'), Date.parse('2022-02-06T14:10:23.567')],
      [Date.parse('2022-02-06T14:10:23.567'), Date.parse('2022-02-06T14:10:43.567')],
      [Date.parse('2022-02-06T14:10:43.567'), Date.parse('2022-02-06T14:11:03.567')],
    ]);
  });
});

describe('logs splitTimeRangeAligned', () => {
  it('should split time range into midnight-aligned chunks', () => {
    const timeRange = makeTimeRange(toUtc('2022-02-01T14:10:03.234Z'), toUtc('2022-02-06T14:11:03.567Z'));
    const result = splitTimeRangeAligned(timeRange);

    expect(result).toStrictEqual([
      [Date.parse('2022-02-01T14:10:03.234Z'), Date.parse('2022-02-02T00:00:00.0Z')],
      [Date.parse('2022-02-02T00:00:00.0Z'), Date.parse('2022-02-03T00:00:00.0Z')],
      [Date.parse('2022-02-03T00:00:00.0Z'), Date.parse('2022-02-04T00:00:00.0Z')],
      [Date.parse('2022-02-04T00:00:00.0Z'), Date.parse('2022-02-05T00:00:00.0Z')],
      [Date.parse('2022-02-05T00:00:00.0Z'), Date.parse('2022-02-06T00:00:00.0Z')],
      [Date.parse('2022-02-06T00:00:00.0Z'), Date.parse('2022-02-06T14:11:03.567Z')],
    ]);
  });

  it('should correctly handle less-than-24h time ranges', () => {
    const timeRange = makeTimeRange(toUtc('2022-02-01T08:10:03.234Z'), toUtc('2022-02-01T20:10:03.234Z'));
    const result = splitTimeRangeAligned(timeRange);

    expect(result).toStrictEqual([[Date.parse('2022-02-01T08:10:03.234Z'), Date.parse('2022-02-01T20:10:03.234Z')]]);
  });
});
