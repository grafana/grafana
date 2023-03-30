import { getRangePartition } from './metricTimeSplitting';

describe('metric getRangeChunks', () => {
  it('should split time range into chunks', () => {
    const start = Date.parse('2022-02-06T14:10:03');
    const end = Date.parse('2022-02-06T14:11:03');
    const step = 10 * 1000;

    expect(getRangePartition(start, end, step, 25000)).toStrictEqual([
      [Date.parse('2022-02-06T14:10:00'), Date.parse('2022-02-06T14:10:10')],
      [Date.parse('2022-02-06T14:10:20'), Date.parse('2022-02-06T14:10:40')],
      [Date.parse('2022-02-06T14:10:50'), Date.parse('2022-02-06T14:11:10')],
    ]);
  });

  it('should return the original interval if requested duration is smaller than step', () => {
    const start = Date.parse('2022-02-06T14:10:03');
    const end = Date.parse('2022-02-06T14:10:33');
    const step = 10 * 1000;
    expect(getRangePartition(start, end, step, 1000)).toEqual([[start, end]]);
  });
});
