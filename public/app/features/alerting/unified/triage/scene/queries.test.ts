import { prometheusExpressionBuilder } from './expressionBuilder';
import {
  alertRuleInstancesQuery,
  getWorkbenchQueries,
  summaryChartQuery,
  summaryInstanceCountQuery,
  uniqueAlertInstancesQuery,
} from './queries';

describe('triage queries service combined filter', () => {
  it('expands service key to service OR service_name in summary chart query', () => {
    const query = summaryChartQuery('service="payments"').expr;

    expect(query).toContain('service="payments"');
    expect(query).toContain('service_name="payments"');
    expect(query).toContain(' or ');
  });

  it('expands service key in workbench queries', () => {
    const [rangeQuery, instantQuery] = getWorkbenchQueries(
      'alertname, grafana_folder, grafana_rule_uid, alertstate',
      'service="payments"'
    );

    expect(rangeQuery.expr).toContain('service="payments"');
    expect(rangeQuery.expr).toContain('service_name="payments"');
    expect(instantQuery.expr).toContain('service="payments"');
    expect(instantQuery.expr).toContain('service_name="payments"');
  });

  it('expands service key in rule instances query while preserving rule uid matcher', () => {
    const query = alertRuleInstancesQuery('rule-1', 'service="payments"').expr;

    expect(query).toContain('grafana_rule_uid="rule-1"');
    expect(query).toContain('service="payments"');
    expect(query).toContain('service_name="payments"');
  });

  it('expands service key in unique instances query used for label breakdown', () => {
    const query = uniqueAlertInstancesQuery('service="payments"').expr;

    expect(query).toContain('last_over_time');
    expect(query).toContain('service="payments"');
    expect(query).toContain('service_name="payments"');
  });

  it('keeps service alias expansion when sidebar filter value came from service_name', () => {
    const query = summaryChartQuery('service="auth",alertname="login-errors"').expr;

    expect(query).toContain('alertname="login-errors",service="auth"');
    expect(query).toContain('alertname="login-errors",service_name="auth"');
    expect(query).toContain(' or ');
  });

  it('expands cluster key to cluster OR cluster_name', () => {
    const query = summaryChartQuery('cluster="prod-a"').expr;

    expect(query).toContain('cluster="prod-a"');
    expect(query).toContain('cluster_name="prod-a"');
    expect(query).toContain(' or ');
  });

  it('cross-multiplies branches when two combined keys are filtered together', () => {
    const query = summaryChartQuery('service="payments",cluster="prod-a"').expr;

    expect(query).toBe(
      'count by (alertstate) ((' +
        'GRAFANA_ALERTS{service="payments",cluster="prod-a"}' +
        ' or GRAFANA_ALERTS{service="payments",cluster_name="prod-a"}' +
        ' or GRAFANA_ALERTS{service_name="payments",cluster="prod-a"}' +
        ' or GRAFANA_ALERTS{service_name="payments",cluster_name="prod-a"}' +
        '))'
    );
  });

  it('expands namespace key to namespace OR exported_namespace OR namespace_extracted', () => {
    const query = uniqueAlertInstancesQuery('namespace="payments"').expr;

    expect(query).toContain('namespace="payments"');
    expect(query).toContain('exported_namespace="payments"');
    expect(query).toContain('namespace_extracted="payments"');
    expect(query).toContain(' or ');
  });

  it('expands severity key across severity-adjacent label keys', () => {
    const query = summaryChartQuery('severity=~"(?i)critical|crit|fatal"').expr;

    expect(query).toContain('severity=~"(?i)critical|crit|fatal"');
    expect(query).toContain('priority=~"(?i)critical|crit|fatal"');
    expect(query).toContain('level=~"(?i)critical|crit|fatal"');
    expect(query).toContain('loglevel=~"(?i)critical|crit|fatal"');
    expect(query).toContain('logLevel=~"(?i)critical|crit|fatal"');
    expect(query).toContain('lvl=~"(?i)critical|crit|fatal"');
    expect(query).toContain('detected_level=~"(?i)critical|crit|fatal"');
    expect(query).toContain(' or ');
  });
});

describe('alertRuleInstancesQuery group scoping', () => {
  it('produces an unscoped query when no groupLabels are provided', () => {
    const query = alertRuleInstancesQuery('rule-1', '').expr;

    expect(query).toContain('grafana_rule_uid="rule-1"');
    expect(query).not.toContain('cluster=');
    expect(query).not.toContain('environment=');
  });

  it('includes group label matchers in the PromQL expression', () => {
    const query = alertRuleInstancesQuery('rule-1', '', {
      environment: 'stg',
    }).expr;

    expect(query).toContain('grafana_rule_uid="rule-1"');
    expect(query).toContain('environment="stg"');
  });

  it('expands combined label keys (cluster) from groupLabels the same way as from filters', () => {
    const query = alertRuleInstancesQuery('rule-1', '', {
      cluster: 'use2-cermak-ice-beeks',
      environment: 'stg',
    }).expr;

    expect(query).toContain('grafana_rule_uid="rule-1"');
    // cluster is a combined key -> expanded to cluster OR cluster_name branches
    expect(query).toContain('cluster="use2-cermak-ice-beeks"');
    expect(query).toContain('cluster_name="use2-cermak-ice-beeks"');
    expect(query).toContain(' or ');
    expect(query).toContain('environment="stg"');
  });

  it('handles empty-value group labels (EmptyLabelValue groups)', () => {
    const query = alertRuleInstancesQuery('rule-1', '', { team: '' }).expr;

    expect(query).toContain('team=""');
  });

  it('combines group labels with ad-hoc filters', () => {
    const query = alertRuleInstancesQuery('rule-1', 'severity="critical"', {
      environment: 'stg',
    }).expr;

    expect(query).toContain('grafana_rule_uid="rule-1"');
    expect(query).toContain('severity="critical"');
    expect(query).toContain('environment="stg"');
  });

  it('produces unscoped query when groupLabels is an empty object', () => {
    const query = alertRuleInstancesQuery('rule-1', '', {}).expr;

    expect(query).toContain('grafana_rule_uid="rule-1"');
    expect(query).not.toContain('cluster=');
    expect(query).not.toContain('environment=');
  });
});

describe('triage queries combined filter exclusions', () => {
  it('keeps every backing label of an excluded key in the same selector', () => {
    const query = summaryChartQuery('cluster!="prod-me-central-1"').expr;

    expect(query).toBe(
      'count by (alertstate) (GRAFANA_ALERTS{cluster!="prod-me-central-1",cluster_name!="prod-me-central-1"})'
    );
    expect(query).not.toContain(' or ');
  });

  it('applies an excluded key to every branch of an included key', () => {
    const query = summaryChartQuery('namespace="alloy-otlp",cluster!="prod-me-central-1"').expr;

    expect(query).toBe(
      'count by (alertstate) (' +
        '(GRAFANA_ALERTS{cluster!="prod-me-central-1",cluster_name!="prod-me-central-1",namespace="alloy-otlp"}' +
        ' or GRAFANA_ALERTS{cluster!="prod-me-central-1",cluster_name!="prod-me-central-1",exported_namespace="alloy-otlp"}' +
        ' or GRAFANA_ALERTS{cluster!="prod-me-central-1",cluster_name!="prod-me-central-1",namespace_extracted="alloy-otlp"})' +
        ')'
    );
  });

  it('combines include and exclude matchers on the same key', () => {
    const query = summaryChartQuery('cluster="prod-a",cluster!="prod-b"').expr;

    expect(query).toBe(
      'count by (alertstate) (' +
        '(GRAFANA_ALERTS{cluster!="prod-b",cluster_name!="prod-b",cluster="prod-a"}' +
        ' or GRAFANA_ALERTS{cluster!="prod-b",cluster_name!="prod-b",cluster_name="prod-a"})' +
        ')'
    );
  });

  it('expands regex exclusions across every backing label', () => {
    const query = summaryChartQuery('severity!~"info|debug"').expr;

    expect(query).toBe(
      'count by (alertstate) (GRAFANA_ALERTS{' +
        'severity!~"info|debug",priority!~"info|debug",level!~"info|debug",loglevel!~"info|debug",' +
        'logLevel!~"info|debug",lvl!~"info|debug",detected_level!~"info|debug"' +
        '})'
    );
    expect(query).not.toContain(' or ');
  });

  it('leaves exclusions on non-combined keys alone', () => {
    const query = summaryChartQuery('environment!="dev"').expr;

    expect(query).toBe('count by (alertstate) (GRAFANA_ALERTS{environment!="dev"})');
  });

  it('keeps multi-value exclusions (!=|) in the same selector', () => {
    // The multi-value operator is rewritten to !~ before it reaches the query builder,
    // so go through the expression builder rather than hand-writing the filter string.
    const filter = prometheusExpressionBuilder([
      { key: 'cluster', operator: '!=|', value: 'prod-me-central-1', values: ['prod-me-central-1', 'prod-eu-west-2'] },
    ]);
    expect(filter).toBe('cluster!~"prod-me-central-1|prod-eu-west-2"');

    const query = summaryChartQuery(filter).expr;

    expect(query).toBe(
      'count by (alertstate) (GRAFANA_ALERTS{' +
        'cluster!~"prod-me-central-1|prod-eu-west-2",cluster_name!~"prod-me-central-1|prod-eu-west-2"' +
        '})'
    );
    expect(query).not.toContain(' or ');
  });

  it('treats an empty-value exclusion as "has any of these labels"', () => {
    const query = summaryChartQuery('cluster!=""').expr;

    // Prometheus reads a missing label as empty, so ANDing the two here would mean
    // "has both labels" and match almost nothing. Branching keeps it to "has either".
    expect(query).toBe('count by (alertstate) ((GRAFANA_ALERTS{cluster!=""} or GRAFANA_ALERTS{cluster_name!=""}))');
  });

  it('carries exclusions into the deduplicated unique-instances query', () => {
    const query = uniqueAlertInstancesQuery('cluster!="prod-me-central-1"').expr;

    expect(query).toContain('alertstate="firing",cluster!="prod-me-central-1",cluster_name!="prod-me-central-1"');
    expect(query).toContain('alertstate="pending",cluster!="prod-me-central-1",cluster_name!="prod-me-central-1"');
  });
});

describe('uniqueAlertInstancesExpr firing/pending dedup', () => {
  // Verified against a real Prometheus: an instance with both a pending and a firing sample
  // in range collapses to firing-only; one that never fired keeps its single pending sample.
  it('collapses a pending instance into its firing state instead of double-counting it', () => {
    const query = uniqueAlertInstancesQuery('').expr;

    expect(query).toBe(
      'last_over_time(GRAFANA_ALERTS{alertstate="firing"}[$__range]) or ' +
        '(last_over_time(GRAFANA_ALERTS{alertstate="pending"}[$__range]) ' +
        'unless ignoring(alertstate, grafana_alertstate) ' +
        'last_over_time(GRAFANA_ALERTS{alertstate="firing"}[$__range]))'
    );
  });
});

describe('alertRuleInstancesQuery vs badge-count query resolution', () => {
  // A bare selector's fixed 5m lookback misses coarse steps; last_over_time(...[$__interval])
  // alone then misses fine steps shorter than the sampling cadence — the OR-fallback covers both.
  it('wraps each selector in (last_over_time(...) or selector) so it works at both coarse and fine steps', () => {
    const query = alertRuleInstancesQuery('rule-1', '');

    expect(query.instant).not.toBe(true);
    expect(query.expr).toBe(
      'count without (alertname, grafana_alertstate, grafana_folder, grafana_rule_uid) ' +
        '((last_over_time(GRAFANA_ALERTS{grafana_rule_uid="rule-1"}[$__interval]) or GRAFANA_ALERTS{grafana_rule_uid="rule-1"}))'
    );
  });

  it('wraps every branch of a combined filter, not just the outer or', () => {
    const query = alertRuleInstancesQuery('rule-1', 'service="payments"');

    expect(query.expr).toBe(
      'count without (alertname, grafana_alertstate, grafana_folder, grafana_rule_uid) ((' +
        '(last_over_time(GRAFANA_ALERTS{grafana_rule_uid="rule-1",service="payments"}[$__interval])' +
        ' or GRAFANA_ALERTS{grafana_rule_uid="rule-1",service="payments"})' +
        ' or ' +
        '(last_over_time(GRAFANA_ALERTS{grafana_rule_uid="rule-1",service_name="payments"}[$__interval])' +
        ' or GRAFANA_ALERTS{grafana_rule_uid="rule-1",service_name="payments"})' +
        '))'
    );
  });

  it('produces a step-independent deduplicated instant query for badge counts', () => {
    const query = summaryInstanceCountQuery('');

    expect(query.instant).toBe(true);
    expect(query.expr).toContain('last_over_time');
    expect(query.expr).toContain('$__range');
    // Badge counts must stay on plain last_over_time — the OR-fallback is only for
    // per-step range queries and would double-count series if applied here too.
    expect(query.expr).not.toContain('$__range]) or GRAFANA_ALERTS');
  });
});

describe('getWorkbenchQueries Query A (tree rows) step-robustness', () => {
  // Same mechanism as alertRuleInstancesQuery above, but losing a whole rule row.
  it('wraps each selector in (last_over_time(...) or selector) so it works at both coarse and fine steps', () => {
    const [rangeQuery] = getWorkbenchQueries('alertname, grafana_folder, grafana_rule_uid, alertstate', '');

    expect(rangeQuery.expr).toBe(
      'count by (alertname, grafana_folder, grafana_rule_uid, alertstate) ' +
        '((last_over_time(GRAFANA_ALERTS{}[$__interval]) or GRAFANA_ALERTS{}))'
    );
  });

  it('wraps every branch of a combined filter, not just the outer or', () => {
    const [rangeQuery] = getWorkbenchQueries(
      'alertname, grafana_folder, grafana_rule_uid, alertstate',
      'service="payments"'
    );

    expect(rangeQuery.expr).toBe(
      'count by (alertname, grafana_folder, grafana_rule_uid, alertstate) ((' +
        '(last_over_time(GRAFANA_ALERTS{service="payments"}[$__interval]) or GRAFANA_ALERTS{service="payments"})' +
        ' or ' +
        '(last_over_time(GRAFANA_ALERTS{service_name="payments"}[$__interval]) or GRAFANA_ALERTS{service_name="payments"})' +
        '))'
    );
  });
});
