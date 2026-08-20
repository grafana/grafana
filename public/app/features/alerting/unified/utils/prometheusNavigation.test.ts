import { type CloudRuleIdentifier, type PrometheusRuleIdentifier } from 'app/types/unified-alerting';

import { mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';

import { prometheusAlertingPlugin } from './prometheusNavigation';

const prometheusIdentifier: PrometheusRuleIdentifier = {
  ruleSourceName: 'Prometheus',
  namespace: 'namespace',
  groupName: 'group',
  ruleName: 'rule',
  ruleHash: 'hash',
};

const encodedPrometheusIdentifier = 'pri%24Prometheus-uid%24namespace%24group%24rule%24hash';

describe('prometheusAlertingPlugin', () => {
  beforeEach(() => {
    setupDataSources(
      mockDataSource({ name: 'Prometheus', uid: 'Prometheus-uid' }),
      mockDataSource({ name: 'Mimir', uid: 'Mimir-uid' })
    );
  });

  it('builds a new-rule route with prefill and navigation state', () => {
    expect(
      prometheusAlertingPlugin.newRule('recording', {
        defaults: '{"type":"cloud-recording"}',
        returnTo: '/dashboard/test',
      })
    ).toBe(
      '/a/grafana-prometheusalerting-app/rules/new?type=recording&defaults=%7B%22type%22%3A%22cloud-recording%22%7D&returnTo=%2Fdashboard%2Ftest'
    );
  });

  it('uses the data source UID and encodes identifiers once', () => {
    expect(prometheusAlertingPlugin.editRule(prometheusIdentifier)).toBe(
      `/a/grafana-prometheusalerting-app/rules/${encodedPrometheusIdentifier}/edit`
    );
    expect(prometheusAlertingPlugin.cloneRule(prometheusIdentifier, { returnTo: '/alerting/list' })).toBe(
      `/a/grafana-prometheusalerting-app/rules/new?copyFrom=${encodedPrometheusIdentifier}&returnTo=%2Falerting%2Flist`
    );
  });

  it('forwards only the navigation state supported by each route', () => {
    expect(
      prometheusAlertingPlugin.viewRule(prometheusIdentifier, { returnTo: '/alerting/list', tab: 'instances' })
    ).toBe(
      `/a/grafana-prometheusalerting-app/rules/${encodedPrometheusIdentifier}?returnTo=%2Falerting%2Flist&tab=instances`
    );
    expect(prometheusAlertingPlugin.editGroup('mimir', 'ns', 'group', { returnTo: '/alerting/list' })).toBe(
      '/a/grafana-prometheusalerting-app/groups/mimir/ns/group/edit?returnTo=%2Falerting%2Flist'
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
  });
});
