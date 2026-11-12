import { summarizeDelivery } from './deliverySummary';

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
