import { totalFromStats } from './ruleStats';

describe('totalFromStats', () => {
  it('should count 0', () => {
    expect(
      totalFromStats({
        alerting: 0,
        error: 0,
        inactive: 0,
        nodata: 0,
        paused: 0,
        pending: 0,
        recording: 0,
      })
    ).toBe(0);
  });

  it('should count rules', () => {
    expect(
      totalFromStats({
        alerting: 2,
        error: 0,
        inactive: 0,
        nodata: 0,
        paused: 0,
        pending: 2,
        recording: 2,
      })
    ).toBe(6);
  });

  it('should not count rule health as a rule', () => {
    expect(
      totalFromStats({
        alerting: 0,
        error: 1,
        inactive: 1,
        nodata: 0,
        paused: 0,
        pending: 0,
        recording: 0,
      })
    ).toBe(1);

    expect(
      totalFromStats({
        alerting: 0,
        error: 0,
        inactive: 0,
        nodata: 1,
        paused: 0,
        pending: 0,
        recording: 1,
      })
    ).toBe(1);

    expect(
      totalFromStats({
        alerting: 0,
        error: 0,
        inactive: 1,
        nodata: 0,
        paused: 1,
        pending: 0,
        recording: 0,
      })
    ).toBe(1);
  });
});
