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
});
