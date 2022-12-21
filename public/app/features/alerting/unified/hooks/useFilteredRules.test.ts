import { setDataSourceSrv } from '@grafana/runtime';

import { PromAlertingRuleState } from '../../../../types/unified-alerting-dto';
import {
  mockAlertQuery,
  mockCombinedRule,
  mockCombinedRuleGroup,
  mockCombinedRuleNamespace,
  mockDataSource,
  MockDataSourceSrv,
  mockPromAlert,
  mockPromAlertingRule,
  mockRulerGrafanaRule,
} from '../mocks';

import { filterRules } from './useFilteredRules';

const dataSources = {
  prometheus: mockDataSource({ uid: 'prom-1', name: 'prometheus' }),
  loki: mockDataSource({ uid: 'loki-1', name: 'loki' }),
};
beforeAll(() => {
  setDataSourceSrv(new MockDataSourceSrv(dataSources));
});

describe('filterRules', function () {
  it('should filter out rules by name filter', function () {
    const rules = [mockCombinedRule({ name: 'High CPU usage' }), mockCombinedRule({ name: 'Memory too low' })];

    const ns = mockCombinedRuleNamespace({
      groups: [mockCombinedRuleGroup('Resources usage group', rules)],
    });

    const filtered = filterRules([ns], { queryString: 'cpu' }, ngFilters);

    expect(filtered[0].groups[0].rules).toHaveLength(1);
    expect(filtered[0].groups[0].rules[0].name).toBe('High CPU usage');
  });

  // it('should filter out rules by evaluation group name', function () {
  //   const ns = mockCombinedRuleNamespace({
  //     groups: [
  //       mockCombinedRuleGroup('Performance group', [mockCombinedRule({ name: 'High CPU usage' })]),
  //       mockCombinedRuleGroup('Availability group', [mockCombinedRule({ name: 'Memory too low' })]),
  //     ],
  //   });
  //
  //   const filtered = filterRules([ns], { queryString: 'memory' });
  //
  //   expect(filtered[0].groups[0].rules).toHaveLength(1);
  //   expect(filtered[])
  //   expect(filtered[0].groups[0].rules[0].name).toBe('Memory too low');
  // });

  it('should filter out rules by label filter', function () {
    const rules = [
      mockCombinedRule({ name: 'High CPU usage', labels: { severity: 'warning' } }),
      mockCombinedRule({ name: 'Memory too low', labels: { severity: 'critical' } }),
    ];

    const ns = mockCombinedRuleNamespace({
      groups: [mockCombinedRuleGroup('Resources usage group', rules)],
    });

    const filtered = filterRules([ns], { queryString: 'severity=critical' }, ngFilters);

    expect(filtered[0].groups[0].rules).toHaveLength(1);
    expect(filtered[0].groups[0].rules[0].name).toBe('Memory too low');
  });

  it('should filter out rules by alert instance labels', function () {
    const rules = [
      mockCombinedRule({
        name: 'High CPU usage',
        promRule: mockPromAlertingRule({ alerts: [mockPromAlert({ labels: { severity: 'warning' } })] }),
      }),
      mockCombinedRule({
        name: 'Memory too low',
        promRule: mockPromAlertingRule({ labels: { severity: 'critical' }, alerts: [] }),
      }),
    ];

    const ns = mockCombinedRuleNamespace({
      groups: [mockCombinedRuleGroup('Resources usage group', rules)],
    });

    const filtered = filterRules([ns], { queryString: 'severity=warning' }, ngFilters);

    expect(filtered[0].groups[0].rules).toHaveLength(1);
    expect(filtered[0].groups[0].rules[0].name).toBe('High CPU usage');
  });

  it('should filter out rules by state filter', function () {
    const rules = [
      mockCombinedRule({
        name: 'High CPU usage',
        promRule: mockPromAlertingRule({ state: PromAlertingRuleState.Inactive }),
      }),
      mockCombinedRule({
        name: 'Memory too low',
        promRule: mockPromAlertingRule({ state: PromAlertingRuleState.Firing }),
      }),
    ];

    const ns = mockCombinedRuleNamespace({
      groups: [mockCombinedRuleGroup('Resources usage group', rules)],
    });

    const filtered = filterRules([ns], { alertState: PromAlertingRuleState.Firing }, ngFilters);

    expect(filtered[0].groups[0].rules).toHaveLength(1);
    expect(filtered[0].groups[0].rules[0].name).toBe('Memory too low');
  });

  it('should filter out rules by datasource', function () {
    const rules = [
      mockCombinedRule({
        name: 'High CPU usage',
        rulerRule: mockRulerGrafanaRule(undefined, {
          data: [mockAlertQuery({ datasourceUid: dataSources.prometheus.uid })],
        }),
      }),
      mockCombinedRule({
        name: 'Memory too low',
        rulerRule: mockRulerGrafanaRule(undefined, {
          data: [mockAlertQuery({ datasourceUid: dataSources.loki.uid })],
        }),
      }),
    ];

    const ns = mockCombinedRuleNamespace({
      groups: [mockCombinedRuleGroup('Resources usage group', rules)],
    });

    const filtered = filterRules([ns], { dataSource: 'loki' }, ngFilters);

    expect(filtered[0].groups[0].rules).toHaveLength(1);
    expect(filtered[0].groups[0].rules[0].name).toBe('Memory too low');
  });
});
