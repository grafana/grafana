import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';

import { PromAlertingRuleState } from '../../../../types/unified-alerting-dto';
import {
  getCloudRule,
  mockAlertQuery,
  mockCombinedCloudRuleNamespace,
  mockCombinedRule,
  mockCombinedRuleGroup,
  mockCombinedRuleNamespace,
  mockDataSource,
  mockPromAlert,
  mockPromAlertingRule,
  mockRulerGrafanaRule,
} from '../mocks';
import { RuleHealth } from '../search/rulesSearchParser';
import { Annotation } from '../utils/constants';
import { getFilter } from '../utils/search';

import { filterRules } from './useFilteredRules';

const dataSources = {
  prometheus: mockDataSource({ uid: 'prom-1', name: 'prometheus' }),
  loki: mockDataSource({ uid: 'loki-1', name: 'loki' }),
};
beforeAll(() => {
  setupDataSources(...Object.values(dataSources));
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
      getCloudRule({ name: 'Cloud' }),
    ];

    const ns = mockCombinedRuleNamespace({
      groups: [mockCombinedRuleGroup('Resources usage group', rules)],
    });
    const cloudNs = mockCombinedCloudRuleNamespace(
      {
        groups: [mockCombinedRuleGroup('Resources usage group', rules)],
      },
      'Prometheus-ds'
    );

    const filtered = filterRules([ns, cloudNs], getFilter({ dataSourceNames: ['loki', 'Prometheus-ds'] }));

    expect(filtered[0].groups[0].rules).toHaveLength(2);
    expect(filtered[0].groups[0].rules[0].name).toBe('Memory too low');
    expect(filtered[0].groups[0].rules[1].name).toBe('Cloud');
  });

  it('should be able to combine multiple predicates with AND', () => {
    const rules = [
      mockCombinedRule({
        name: 'Memory too low',
        labels: { team: 'operations', region: 'EMEA' },
        promRule: mockPromAlertingRule({
          health: RuleHealth.Ok,
        }),
      }),
      mockCombinedRule({
        name: 'Memory too low',
        labels: { team: 'operations', region: 'NASA' },
        promRule: mockPromAlertingRule({
          health: RuleHealth.Ok,
        }),
      }),
    ];

    const ns = mockCombinedRuleNamespace({
      groups: [mockCombinedRuleGroup('Resources usage group', rules)],
    });

    const filtered = filterRules(
      [ns],
      getFilter({
        ruleHealth: RuleHealth.Ok,
        labels: ['team=operations', 'region=EMEA'],
      })
    );

    expect(filtered[0]?.groups[0]?.rules).toHaveLength(1);
    expect(filtered[0]?.groups[0]?.rules[0]?.name).toBe('Memory too low');
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

  it('should filter out rules by dashboard UID', () => {
    const rules = [
      mockCombinedRule({
        name: 'Memory too low',
        annotations: { [Annotation.dashboardUID]: 'dashboard-memory' },
      }),
      mockCombinedRule({
        name: 'CPU too high',
        annotations: { [Annotation.dashboardUID]: 'dashboard-cpu' },
      }),
      mockCombinedRule({
        name: 'Disk is dead',
      }),
    ];

    const ns = mockCombinedRuleNamespace({
      groups: [mockCombinedRuleGroup('Resources usage group', rules)],
    });

    const filtered = filterRules([ns], getFilter({ dashboardUid: 'dashboard-cpu' }));

    expect(filtered[0]?.groups[0]?.rules).toHaveLength(1);
    expect(filtered[0]?.groups[0]?.rules[0]?.name).toBe('CPU too high');
  });

  it('does not crash when trying to filter with regex-like strings', () => {
    const rules = [mockCombinedRule({ name: '[alongnameinthefirstgroup]' })];

    const ns = mockCombinedRuleNamespace({
      name: 'foo|bar',
      groups: [
        // Create group with regex-like name so we can test that searching for it doesn't crash,
        // and so we can test further paths of the filtering
        // (we need some a group to be matched so we can test filtering by rule name as well)
        mockCombinedRuleGroup('some|group', rules),
      ],
    });

    const ruleQuery = '[alongnameinthefirstgroup][thishas spaces][somethingelse]';
    const namespaceQuery = 'foo|bar';
    const groupQuery = 'some|group';
    const freeForm = '.+';

    expect(() =>
      filterRules(
        [ns],
        getFilter({ groupName: groupQuery, ruleName: ruleQuery, namespace: namespaceQuery, freeFormWords: [freeForm] })
      )
    ).not.toThrow();
  });

  // these test may same to be the same as the one above but it tests different edge-cases
  it('does not crash with other regex values', () => {
    const rules = [mockCombinedRule({ name: 'rule' })];

    const ns = mockCombinedRuleNamespace({
      name: 'namespace',
      groups: [mockCombinedRuleGroup('group', rules)],
    });

    expect(() => filterRules([ns], getFilter({ freeFormWords: ['.+'] }))).not.toThrow();
  });
});
