import { alertRuleInstancesQuery, getWorkbenchQueries, summaryChartQuery, uniqueAlertInstancesQuery } from './queries';

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
