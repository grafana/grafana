import { config } from '@grafana/runtime';

import { checkEvaluationIntervalGlobalLimit } from './config';

describe('checkEvaluationIntervalGlobalLimit', () => {
  it('should NOT exceed limit if evaluate every is not valid duration', () => {
    config.unifiedAlerting.minInterval = '2m30s';

    const { globalLimit, exceedsLimit } = checkEvaluationIntervalGlobalLimit('123notvalidduration');

    expect(globalLimit).toBe(150 * 1000);
    expect(exceedsLimit).toBe(false);
  });

  it('should NOT exceed limit if config minInterval is not valid duration', () => {
    config.unifiedAlerting.minInterval = '1A8IU3A';

    const { globalLimit, exceedsLimit } = checkEvaluationIntervalGlobalLimit('1m30s');

    expect(globalLimit).toBe(0);
    expect(exceedsLimit).toBe(false);
  });

  it.each([
    ['2m30s', '1m30s'],
    ['30s', '10s'],
    ['1d2h', '2h'],
    ['1y', '90d'],
  ])(
    'should exceed limit if config minInterval (%s) is greater than evaluate every (%s)',
    (minInterval, evaluateEvery) => {
      config.unifiedAlerting.minInterval = minInterval;

      const { globalLimit, exceedsLimit } = checkEvaluationIntervalGlobalLimit(evaluateEvery);

      expect(globalLimit).toBeGreaterThan(0);
      expect(exceedsLimit).toBe(true);
    }
  );

  it.each([
    ['1m30s', '2m30s'],
    ['30s', '1d'],
    ['1m10s', '1h30m15s'],
  ])('should NOT exceed limit if config minInterval is lesser than evaluate every', (minInterval, evaluateEvery) => {
    config.unifiedAlerting.minInterval = minInterval;

    const { globalLimit, exceedsLimit } = checkEvaluationIntervalGlobalLimit(evaluateEvery);

    expect(globalLimit).toBeGreaterThan(0);
    expect(exceedsLimit).toBe(false);
  });
});
