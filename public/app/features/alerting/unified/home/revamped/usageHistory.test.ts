import { dateTime } from '@grafana/data';

import { buildUsageQueries, getUsageStepSeconds, summarizeUsageHistory } from './usageHistory';

describe('buildUsageQueries', () => {
  it('scopes every query to the stack when the instance id is known', () => {
    expect(buildUsageQueries('123')).toEqual({
      activeRules: 'sum(grafanacloud_grafana_instance_alerting_rule_group_rules{state="active", id="123"})',
      pausedRules: 'sum(grafanacloud_grafana_instance_alerting_rule_group_rules{state="paused", id="123"})',
      firing: 'sum(grafanacloud_grafana_instance_alerting_alerts{state="alerting", id="123"})',
      pending: 'sum(grafanacloud_grafana_instance_alerting_alerts{state="pending", id="123"})',
      evaluations: 'sum(grafanacloud_grafana_instance_alerting_rule_evaluations_total:rate5m{id="123"})',
      failures: 'sum(grafanacloud_grafana_instance_alerting_rule_evaluation_failures_total:rate5m{id="123"})',
    });
  });

  it('leaves the instance filter out when the instance id is unknown', () => {
    expect(buildUsageQueries(undefined).firing).toBe(
      'sum(grafanacloud_grafana_instance_alerting_alerts{state="alerting"})'
    );
    expect(buildUsageQueries(undefined).evaluations).toBe(
      'sum(grafanacloud_grafana_instance_alerting_rule_evaluations_total:rate5m)'
    );
  });
});

describe('getUsageStepSeconds', () => {
  it('splits the range into about 60 points', () => {
    const to = dateTime('2026-11-13T00:00:00Z');
    const from = dateTime('2026-11-06T00:00:00Z');
    expect(getUsageStepSeconds({ from, to, raw: { from, to } })).toBe(10080);
  });

  it('never steps faster than once a minute', () => {
    const to = dateTime('2026-11-13T00:00:00Z');
    const from = dateTime('2026-11-12T23:30:00Z');
    expect(getUsageStepSeconds({ from, to, raw: { from, to } })).toBe(60);
  });
});

describe('summarizeUsageHistory', () => {
  it('turns evaluation rates into totals over the range and a success rate per point', () => {
    // Two 60 second steps: 10/s with 1/s failing, then 10/s with none failing.
    const history = summarizeUsageHistory({ evaluations: [10, 10], failures: [1, 0] }, 60);

    expect(history.evaluations).toEqual({ succeeded: 1140, failed: 60 });
    expect(history.successRate).toEqual([90, 100]);
  });

  it('skips points with no evaluations instead of counting them as failures', () => {
    expect(summarizeUsageHistory({ evaluations: [0, 4], failures: [0, 1] }, 60).successRate).toEqual([75]);
  });

  it('has no evaluation totals when the evaluation series is missing', () => {
    const history = summarizeUsageHistory({ activeRules: [3, 4], firing: [1, 2] }, 60);

    expect(history.evaluations).toBeUndefined();
    expect(history).toMatchObject({ activeRules: [3, 4], firing: [1, 2], pausedRules: [], pending: [] });
  });
});
