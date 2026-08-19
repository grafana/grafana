import { type CloudRuleIdentifier, type PrometheusRuleIdentifier } from 'app/types/unified-alerting';

import { mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';

import { prometheusAlertingPlugin } from './prometheusNavigation';

describe('prometheusAlertingPlugin', () => {
  beforeEach(() => {
    setupDataSources(
      mockDataSource({ name: 'Prometheus', uid: 'Prometheus-uid' }),
      mockDataSource({ name: 'Mimir', uid: 'Mimir-uid' })
    );
  });

  it('builds the plugin rules routes', () => {
    expect(prometheusAlertingPlugin.install).toBe('/plugins/grafana-prometheusalerting-app');
    expect(prometheusAlertingPlugin.rules).toBe('/a/grafana-prometheusalerting-app/rules');
    expect(prometheusAlertingPlugin.newRule('alerting')).toBe(
      '/a/grafana-prometheusalerting-app/rules/new?type=alerting'
    );
    expect(prometheusAlertingPlugin.newRule('recording')).toBe(
      '/a/grafana-prometheusalerting-app/rules/new?type=recording'
    );
    expect(
      prometheusAlertingPlugin.newRule('recording', {
        defaults: '{"type":"cloud-recording"}',
        returnTo: '/dashboard/test',
      })
    ).toBe(
      '/a/grafana-prometheusalerting-app/rules/new?type=recording&defaults=%7B%22type%22%3A%22cloud-recording%22%7D&returnTo=%2Fdashboard%2Ftest'
    );
  });

  it('uses the data source UID in Prometheus rule identifiers', () => {
    const identifier: PrometheusRuleIdentifier = {
      ruleSourceName: 'Prometheus',
      namespace: 'namespace',
      groupName: 'group',
      ruleName: 'rule',
      ruleHash: 'hash',
    };

    expect(prometheusAlertingPlugin.viewRule(identifier)).toBe(
      '/a/grafana-prometheusalerting-app/rules/pri%24Prometheus-uid%24namespace%24group%24rule%24hash'
    );
    expect(prometheusAlertingPlugin.editRule(identifier)).toBe(
      '/a/grafana-prometheusalerting-app/rules/pri%24Prometheus-uid%24namespace%24group%24rule%24hash/edit'
    );
    expect(prometheusAlertingPlugin.cloneRule(identifier)).toBe(
      '/a/grafana-prometheusalerting-app/rules/new?copyFrom=pri%24Prometheus-uid%24namespace%24group%24rule%24hash'
    );
  });

  it('uses the data source UID in Cloud rule identifiers', () => {
    const identifier: CloudRuleIdentifier = {
      ruleSourceName: 'Mimir',
      namespace: 'namespace',
      groupName: 'group',
      ruleName: 'rule',
      rulerRuleHash: 'hash',
    };

    expect(prometheusAlertingPlugin.editRule(identifier)).toBe(
      '/a/grafana-prometheusalerting-app/rules/cri%24Mimir-uid%24namespace%24group%24rule%24hash/edit'
    );
  });

  it('encodes group route segments', () => {
    expect(prometheusAlertingPlugin.viewGroup('prometheus/uid', 'team namespace', 'group/name')).toBe(
      '/a/grafana-prometheusalerting-app/groups/prometheus%2Fuid/team%20namespace/group%2Fname'
    );
    expect(prometheusAlertingPlugin.editGroup('prometheus/uid', 'team namespace', 'group/name')).toBe(
      '/a/grafana-prometheusalerting-app/groups/prometheus%2Fuid/team%20namespace/group%2Fname/edit'
    );
  });
});
