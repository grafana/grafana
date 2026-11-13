import { summarizeDelivery, summarizeDeliveryOverTime, summarizeDeliveryTrend } from './deliverySummary';

describe('summarizeDeliveryTrend', () => {
  it('gives the share of successful attempts at each timestamp, in time order', () => {
    const trend = summarizeDeliveryTrend([
      {
        outcome: 'success',
        count: 0,
        values: [
          { timestamp: 2000, count: 9 },
          { timestamp: 1000, count: 3 },
        ],
      },
      { outcome: 'error', count: 0, values: [{ timestamp: 2000, count: 1 }] },
    ]);

    expect(trend).toEqual([100, 90]);
  });

  it('skips timestamps with no attempts', () => {
    const trend = summarizeDeliveryTrend([
      {
        outcome: 'success',
        count: 0,
        values: [
          { timestamp: 1000, count: 0 },
          { timestamp: 2000, count: 4 },
        ],
      },
    ]);

    expect(trend).toEqual([100]);
  });
});

describe('summarizeDelivery', () => {
  it('adds successful and failed attempts into one row per integration, with failures counted separately', () => {
    const summary = summarizeDelivery([
      { integration: 'slack', outcome: 'success', count: 120, values: [] },
      { integration: 'slack', outcome: 'error', count: 3, values: [] },
      { integration: 'email', outcome: 'success', count: 40, values: [] },
    ]);

    expect(summary).toEqual({
      attempts: 163,
      failed: 3,
      channels: [
        { integration: 'slack', attempts: 123, failed: 3 },
        { integration: 'email', attempts: 40, failed: 0 },
      ],
    });
  });

  it('puts the channel with the most failures first, even when it has fewer attempts', () => {
    const summary = summarizeDelivery([
      { integration: 'slack', outcome: 'success', count: 1000, values: [] },
      { integration: 'pagerduty', outcome: 'success', count: 10, values: [] },
      { integration: 'pagerduty', outcome: 'error', count: 4, values: [] },
      { integration: 'webhook', outcome: 'success', count: 50, values: [] },
    ]);

    expect(summary.channels.map((channel) => channel.integration)).toEqual(['pagerduty', 'slack', 'webhook']);
  });

  it('returns zero totals and no channels when there were no attempts', () => {
    expect(summarizeDelivery([])).toEqual({ attempts: 0, failed: 0, channels: [] });
  });
});

describe('summarizeDeliveryOverTime', () => {
  it('gives sent and failed attempts per timestamp, in time order, with zero where an outcome had none', () => {
    const series = summarizeDeliveryOverTime([
      {
        outcome: 'success',
        count: 0,
        values: [
          { timestamp: 2000, count: 9 },
          { timestamp: 1000, count: 3 },
        ],
      },
      { outcome: 'error', count: 0, values: [{ timestamp: 2000, count: 1 }] },
    ]);

    expect(series).toEqual({ times: [1000, 2000], sent: [3, 9], failed: [0, 1] });
  });
});
