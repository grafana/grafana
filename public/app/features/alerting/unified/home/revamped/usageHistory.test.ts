import { dateTime } from '@grafana/data';

import {
  buildAlertmanagerQueries,
  buildMissedEvaluationQueries,
  buildUsageQueries,
  getUsageStepSeconds,
  summarizeMissedEvaluations,
  summarizeUsageHistory,
} from './usageHistory';

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

describe('buildMissedEvaluationQueries', () => {
  it('averages the missed rate over the range per rule title, for the top rules and for all of them', () => {
    expect(buildMissedEvaluationQueries('123', 604800)).toEqual({
      topMissed:
        'topk(5, sum by (rule_title) (avg_over_time(grafanacloud_grafana_instance_alerting_schedule_rule_evaluations_missed_total:rate5m{id="123"}[604800s])))',
      totalMissed:
        'sum(avg_over_time(grafanacloud_grafana_instance_alerting_schedule_rule_evaluations_missed_total:rate5m{id="123"}[604800s]))',
    });
  });
});

describe('summarizeMissedEvaluations', () => {
  it('turns average rates into missed evaluations over the range, with each rule share of all of them', () => {
    // Over 1,000 seconds: 0.04/s is 40 missed, 0.01/s is 10, of 0.1/s (100) in total.
    const rules = summarizeMissedEvaluations(
      [
        { labels: { rule_title: 'Disk full' }, values: [0.01], times: [0] },
        { labels: { rule_title: 'CPU high' }, values: [0.04], times: [0] },
      ],
      [{ labels: {}, values: [0.1], times: [0] }],
      1000
    );

    expect(rules).toEqual([
      { title: 'CPU high', missed: 40, share: 0.4 },
      { title: 'Disk full', missed: 10, share: 0.1 },
    ]);
  });

  it('leaves out rules that missed nothing', () => {
    expect(summarizeMissedEvaluations([{ labels: { rule_title: 'Fine' }, values: [0], times: [0] }], [], 1000)).toEqual(
      []
    );
  });
});

describe('buildAlertmanagerQueries', () => {
  it('reads the Grafana Alertmanager series, falling back to the Grafana Cloud Alertmanager for stacks that use it', () => {
    expect(buildAlertmanagerQueries('123')).toEqual({
      alerts:
        'sum by (state) (grafanacloud_grafana_instance_alerting_alertmanager_alerts{id="123"}) or sum by (state) (grafanacloud_instance_alertmanager_alerts{stack_id="123"})',
      silences:
        'sum by (state) (grafanacloud_grafana_instance_alerting_silences{id="123"}) or sum by (state) (grafanacloud_instance_alertmanager_silences{stack_id="123"})',
    });
  });
});
