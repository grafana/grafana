import { getAttentionItems } from './attentionItems';
import { type GrafanaRulesSummary } from './grafanaRulesSummary';

const healthyRules: GrafanaRulesSummary = {
  totalRules: 10,
  activeRules: 10,
  pausedRules: 0,
  failingRules: 0,
  instances: { firing: 0, pending: 0, recovering: 0, noData: 0, error: 0, normal: 10 },
  topFiringRules: [],
  alertingRules: new Map(),
  capped: false,
};

describe('getAttentionItems', () => {
  it('returns nothing for a healthy stack', () => {
    expect(
      getAttentionItems({
        rules: healthyRules,
        delivery: { attempts: 5, failed: 0, channels: [{ integration: 'slack', attempts: 5, failed: 0 }] },
      })
    ).toEqual([]);
  });

  it('orders failing rules and failing channels before instance problems and paused rules', () => {
    const items = getAttentionItems({
      rules: {
        ...healthyRules,
        failingRules: 3,
        pausedRules: 2,
        instances: { ...healthyRules.instances, noData: 1, error: 1 },
      },
      delivery: {
        attempts: 30,
        failed: 7,
        channels: [
          { integration: 'pagerduty', attempts: 10, failed: 6 },
          { integration: 'slack', attempts: 20, failed: 1 },
        ],
      },
    });

    expect(items.map((item) => [item.id, item.severity])).toEqual([
      ['failing-rules', 'error'],
      ['failing-channels', 'error'],
      ['error-instances', 'error'],
      ['nodata-instances', 'warning'],
      ['paused-rules', 'warning'],
    ]);
  });

  it('links failing rules to the rule list filtered by error health', () => {
    const [item] = getAttentionItems({ rules: { ...healthyRules, failingRules: 3 } });

    expect(item.title).toBe('3 rules are failing to evaluate');
    expect(item.href).toBe('/alerting/list?search=health:error');
  });

  it('names the channel with the most failures and counts every channel that failed', () => {
    const [item] = getAttentionItems({
      delivery: {
        attempts: 30,
        failed: 7,
        channels: [
          { integration: 'pagerduty', attempts: 10, failed: 6 },
          { integration: 'slack', attempts: 20, failed: 1 },
        ],
      },
    });

    expect(item.title).toBe('2 channels failed to deliver notifications');
    expect(item.description).toBe('Most failures: pagerduty.');
  });

  it('flags alert instances in no data and in error, linking to the rule list filtered by that health', () => {
    const items = getAttentionItems({
      rules: { ...healthyRules, instances: { ...healthyRules.instances, noData: 10, error: 2 } },
    });

    expect(items.map((item) => [item.id, item.severity, item.title, item.href])).toEqual([
      ['error-instances', 'error', '2 alert instances are in error', '/alerting/list?search=health:error'],
      ['nodata-instances', 'warning', '10 alert instances have no data', '/alerting/list?search=health:nodata'],
    ]);
  });

  it('skips sources that have not loaded', () => {
    const delivery = { attempts: 5, failed: 2, channels: [{ integration: 'slack', attempts: 5, failed: 2 }] };

    expect(getAttentionItems({ delivery }).map((item) => item.id)).toEqual(['failing-channels']);
    expect(getAttentionItems({})).toEqual([]);
  });
});
