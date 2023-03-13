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
import { RuleHealth } from '../search/rulesSearchParser';
import { getFilter } from '../utils/search';

import { filterRules } from './useFilteredRules';

const dataSources = {
  prometheus: mockDataSource({ uid: 'prom-1', name: 'prometheus' }),
  loki: mockDataSource({ uid: 'loki-1', name: 'loki' }),
};
beforeAll(() => {
  setDataSourceSrv(new MockDataSourceSrv(dataSources));
});

describe('filterRules', function () {
  // Typos there are deliberate to test the fuzzy search
  it.each(['cpu', 'hi usage', 'usge'])('should filter out rules by name filter = "%s"', function (nameFilter) {
    const rules = [mockCombinedRule({ name: 'High CPU usage' }), mockCombinedRule({ name: 'Memory too low' })];

    const ns = mockCombinedRuleNamespace({
      groups: [mockCombinedRuleGroup('Resources usage group', rules)],
    });

    const filtered = filterRules([ns], getFilter({ ruleName: nameFilter }));

    expect(filtered[0].groups[0].rules).toHaveLength(1);
    expect(filtered[0].groups[0].rules[0].name).toBe('High CPU usage');
  });

  // Typos there are deliberate to test the fuzzy search
  it.each(['availability', 'avialability', 'avail group'])(
    'should filter out rules by evaluation group name = "%s"',
    function (groupFilter) {
      const ns = mockCombinedRuleNamespace({
        groups: [
          mockCombinedRuleGroup('Performance group', [mockCombinedRule({ name: 'High CPU usage' })]),
          mockCombinedRuleGroup('Availability group', [mockCombinedRule({ name: 'Memory too low' })]),
        ],
      });

      const filtered = filterRules([ns], getFilter({ groupName: groupFilter }));

      expect(filtered[0].groups).toHaveLength(1);
      expect(filtered[0].groups[0].rules[0].name).toBe('Memory too low');
    }
  );

  it('should filter out rules by label filter', function () {
    const rules = [
      mockCombinedRule({ name: 'High CPU usage', labels: { severity: 'warning' } }),
      mockCombinedRule({ name: 'Memory too low', labels: { severity: 'critical' } }),
    ];

    const ns = mockCombinedRuleNamespace({
      groups: [mockCombinedRuleGroup('Resources usage group', rules)],
    });

    const filtered = filterRules([ns], getFilter({ labels: ['severity=critical'] }));

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

    const filtered = filterRules([ns], getFilter({ labels: ['severity=warning'] }));

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

    const filtered = filterRules([ns], getFilter({ ruleState: PromAlertingRuleState.Firing }));

    expect(filtered[0].groups[0].rules).toHaveLength(1);
    expect(filtered[0].groups[0].rules[0].name).toBe('Memory too low');
  });

  it('should filter out rules by health filter', function () {
    const rules = [
      mockCombinedRule({
        name: 'High CPU usage',
        promRule: mockPromAlertingRule({ health: RuleHealth.Ok }),
      }),
      mockCombinedRule({
        name: 'Memory too low',
        promRule: mockPromAlertingRule({ health: RuleHealth.Error }),
      }),
    ];

    const ns = mockCombinedRuleNamespace({
      groups: [mockCombinedRuleGroup('Resources usage group', rules)],
    });

    const filtered = filterRules([ns], getFilter({ ruleHealth: RuleHealth.Error }));

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

    const filtered = filterRules([ns], getFilter({ dataSourceName: 'loki' }));

    expect(filtered[0].groups[0].rules).toHaveLength(1);
    expect(filtered[0].groups[0].rules[0].name).toBe('Memory too low');
  });

  // Typos there are deliberate to test the fuzzy search
  it.each(['nasa', 'alrt rul', 'nasa ruls'])('should filter out rules by namespace = "%s"', (namespaceFilter) => {
    const cpuRule = mockCombinedRule({ name: 'High CPU usage' });
    const memoryRule = mockCombinedRule({ name: 'Memory too low' });

    const teamEmeaNs = mockCombinedRuleNamespace({
      name: 'EMEA Alerting',
      groups: [mockCombinedRuleGroup('CPU group', [cpuRule])],
    });

    const teamNasaNs = mockCombinedRuleNamespace({
      name: 'NASA Alert Rules',
      groups: [mockCombinedRuleGroup('Memory group', [memoryRule])],
    });

    const filtered = filterRules([teamEmeaNs, teamNasaNs], getFilter({ namespace: namespaceFilter }));

    expect(filtered[0].groups[0].rules).toHaveLength(1);
    expect(filtered[0].groups[0].rules[0].name).toBe('Memory too low');
  });
});
