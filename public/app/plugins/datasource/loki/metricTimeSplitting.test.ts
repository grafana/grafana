import { splitTimeRange } from './metricTimeSplitting';

describe('metric splitTimeRange', () => {
  it('should split time range into chunks with 1day split and duration', () => {
    const start = Date.parse('2022-02-06T14:10:03Z');
    const end = Date.parse('2022-02-08T14:11:03Z');
    const step = 24 * 60 * 60 * 1000; // 1 day
    const rangeDuration = 24 * 60 * 60 * 1000; // 1 day

    expect(splitTimeRange(start, end, step, rangeDuration)).toStrictEqual([
      [Date.parse('2022-02-06T00:00:00Z'), Date.parse('2022-02-06T00:00:00Z')],
      [Date.parse('2022-02-07T00:00:00Z'), Date.parse('2022-02-07T00:00:00Z')],
      [Date.parse('2022-02-08T00:00:00Z'), Date.parse('2022-02-08T00:00:00Z')],
    ]);
  });

  it('should split time range into chunks with 1day split and duration and a 5 minute duration', () => {
    const start = Date.parse('2022-02-06T14:00:00Z');
    const end = Date.parse('2022-02-06T14:05:00Z');
    const step = 24 * 60 * 60 * 1000; // 1 day
    const rangeDuration = 24 * 60 * 60 * 1000; // 1 day

    expect(splitTimeRange(start, end, step, rangeDuration)).toStrictEqual([
      [Date.parse('2022-02-06T00:00:00Z'), Date.parse('2022-02-06T00:00:00Z')],
    ]);
  });

  it('should split time range into chunks with 1hour split and 1day duration', () => {
    const start = Date.parse('2022-02-06T14:10:03Z');
    const end = Date.parse('2022-02-08T14:11:03Z');
    const step = 60 * 60 * 1000; // 1 hour
    const rangeDuration = 24 * 60 * 60 * 1000; // 1 day

    expect(splitTimeRange(start, end, step, rangeDuration)).toStrictEqual([
      [Date.parse('2022-02-06T14:00:00Z'), Date.parse('2022-02-07T13:00:00Z')],
      [Date.parse('2022-02-07T14:00:00Z'), Date.parse('2022-02-08T13:00:00Z')],
      [Date.parse('2022-02-08T14:00:00Z'), Date.parse('2022-02-08T14:11:03Z')],
    ]);
  });

  it('should split time range into chunks with 1hour split and 12h duration', () => {
    const start = Date.parse('2022-02-06T14:10:03Z');
    const end = Date.parse('2022-02-08T14:11:03Z');
    const step = 60 * 60 * 1000; // 1 hour
    const rangeDuration = 12 * 60 * 60 * 1000; // 12h

    expect(splitTimeRange(start, end, step, rangeDuration)).toStrictEqual([
      [Date.parse('2022-02-06T14:00:00Z'), Date.parse('2022-02-07T01:00:00Z')],
      [Date.parse('2022-02-07T02:00:00Z'), Date.parse('2022-02-07T13:00:00Z')],
      [Date.parse('2022-02-07T14:00:00Z'), Date.parse('2022-02-08T01:00:00Z')],
      [Date.parse('2022-02-08T02:00:00Z'), Date.parse('2022-02-08T13:00:00Z')],
      [Date.parse('2022-02-08T14:00:00Z'), Date.parse('2022-02-08T14:11:03Z')],
    ]);
  });

  it('should return the original interval if requested duration is smaller than step', () => {
    const start = Date.parse('2022-02-06T14:10:03');
    const end = Date.parse('2022-02-06T14:10:33');
    const step = 10 * 1000;
    expect(splitTimeRange(start, end, step, 1000)).toEqual([[start, end]]);
  });
});
