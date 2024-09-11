import { calculateNextEvaluationEstimate } from './util';

describe('calculateNextEvaluationEstimate', () => {
  const MOCK_NOW = new Date('2024-05-23T12:00:00');

  beforeEach(() => {
    jest.useFakeTimers({ now: MOCK_NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('with timestamp of last evaluation', () => {
    // a minute ago
    const lastEvaluation = new Date(MOCK_NOW.valueOf() - 60 * 1000).toISOString();
    const interval = '5m';

    const output = calculateNextEvaluationEstimate(lastEvaluation, interval);
    expect(output).toStrictEqual({
      humanized: 'in 4 minutes',
      fullDate: '2024-05-23 12:04:00',
    });
  });

  test('with last evaluation having missed ticks', () => {
    // 6 minutes ago, so we missed a tick
    const lastEvaluation = new Date(MOCK_NOW.valueOf() - 6 * 60 * 1000).toISOString();
    const interval = '5m';

    const output = calculateNextEvaluationEstimate(lastEvaluation, interval);
    expect(output).toStrictEqual({
      humanized: 'within 5m',
      fullDate: 'within 5m',
    });
  });
});
