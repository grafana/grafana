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
    expect(prometheusAlertingPlugin.viewRule(prometheusIdentifier)).toBe(
      '/a/grafana-prometheusalerting-app/rules/pri%24Prometheus-uid%24namespace%24group%24rule%24hash'
    );
    expect(prometheusAlertingPlugin.editRule(prometheusIdentifier)).toBe(
      '/a/grafana-prometheusalerting-app/rules/pri%24Prometheus-uid%24namespace%24group%24rule%24hash/edit'
    );
    expect(prometheusAlertingPlugin.cloneRule(prometheusIdentifier)).toBe(
      '/a/grafana-prometheusalerting-app/rules/new?copyFrom=pri%24Prometheus-uid%24namespace%24group%24rule%24hash'
    );
  });

  it('forwards navigation state to the plugin', () => {
    const stringified = 'pri%24Prometheus-uid%24namespace%24group%24rule%24hash';

    expect(
      prometheusAlertingPlugin.viewRule(prometheusIdentifier, { returnTo: '/alerting/list', tab: 'instances' })
    ).toBe(`/a/grafana-prometheusalerting-app/rules/${stringified}?returnTo=%2Falerting%2Flist&tab=instances`);
    expect(prometheusAlertingPlugin.editRule(prometheusIdentifier, { returnTo: '/alerting/list' })).toBe(
      `/a/grafana-prometheusalerting-app/rules/${stringified}/edit?returnTo=%2Falerting%2Flist`
    );
    expect(prometheusAlertingPlugin.cloneRule(prometheusIdentifier, { returnTo: '/alerting/list' })).toBe(
      `/a/grafana-prometheusalerting-app/rules/new?copyFrom=${stringified}&returnTo=%2Falerting%2Flist`
    );
    expect(prometheusAlertingPlugin.editGroup('mimir', 'ns', 'group', { returnTo: '/alerting/list' })).toBe(
      '/a/grafana-prometheusalerting-app/groups/mimir/ns/group/edit?returnTo=%2Falerting%2Flist'
    );
  });

  it('omits navigation params that are not set', () => {
    expect(prometheusAlertingPlugin.newRule('alerting', { returnTo: undefined, defaults: undefined })).toBe(
      '/a/grafana-prometheusalerting-app/rules/new?type=alerting'
    );
    expect(prometheusAlertingPlugin.viewGroup('mimir', 'ns', 'group')).toBe(
      '/a/grafana-prometheusalerting-app/groups/mimir/ns/group'
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
