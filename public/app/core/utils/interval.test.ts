import { populateInterval } from './interval';
import { DataQueryRequest, TimeRange, dateTime } from '@grafana/data';

describe('populateInterval', () => {
  it('returns a valid interval', () => {
    expect(
      populateInterval(
        {} as DataQueryRequest,
        { from: dateTime(1546372800000), to: dateTime(1546380000000) } as TimeRange,
        200,
        '15s'
      )
    ).toMatchObject({
      scopedVars: {
        __interval: { text: '30s', value: '30s' },
        __interval_s: { text: '30', value: 30 },
        __interval_ms: { text: '30000', value: 30000 },
      },
      interval: '30s',
      intervalMs: 30000,
    });
  });
});
