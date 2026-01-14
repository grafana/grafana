import { CombinedRule } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { RuleSortOrder } from '../components/rules/RulesSortingSelector';

import { sortRules } from './rulesSorting';

function createMockRule(overrides: Partial<CombinedRule> & { name: string }): CombinedRule {
  return {
    name: overrides.name,
    query: '',
    labels: {},
    annotations: {},
    group: { name: 'test-group', rules: [], totals: {} },
    namespace: { name: 'test-namespace', groups: [], rulesSource: 'grafana' },
    instanceTotals: {},
    filteredInstanceTotals: {},
    ...overrides,
  };
}

function createAlertingRule(
  name: string,
  state: PromAlertingRuleState,
  lastEvaluation?: string
): CombinedRule {
  return createMockRule({
    name,
    promRule: {
      name,
      type: 'alerting',
      state,
      query: '',
      labels: {},
      annotations: {},
      health: 'ok',
      lastEvaluation,
      evaluationTime: 0,
      alerts: [],
    },
  });
}

function createGrafanaRule(
  name: string,
  state: PromAlertingRuleState,
  updated?: string
): CombinedRule {
  const rule = createAlertingRule(name, state);
  rule.rulerRule = {
    grafana_alert: {
      id: 1,
      orgId: 1,
      title: name,
      condition: 'A',
      data: [],
      updated: updated || '2024-01-01T00:00:00Z',
      namespace_uid: 'test-folder',
      rule_group: 'test-group',
      no_data_state: 'NoData',
      exec_err_state: 'Alerting',
      uid: `rule-${name}`,
    },
    for: '5m',
    labels: {},
    annotations: {},
  };
  return rule;
}

describe('sortRules', () => {
  describe('when sortOrder is undefined', () => {
    it('should return rules unchanged', () => {
      const rules = [
        createMockRule({ name: 'Charlie' }),
        createMockRule({ name: 'Alpha' }),
        createMockRule({ name: 'Bravo' }),
      ];

      const result = sortRules(rules, undefined);

      expect(result.map((r) => r.name)).toEqual(['Charlie', 'Alpha', 'Bravo']);
    });
  });

  describe('alphabetical sorting', () => {
    it('should sort A-Z correctly', () => {
      const rules = [
        createMockRule({ name: 'Charlie' }),
        createMockRule({ name: 'Alpha' }),
        createMockRule({ name: 'Bravo' }),
      ];

      const result = sortRules(rules, RuleSortOrder.AlphaAsc);

      expect(result.map((r) => r.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    it('should sort Z-A correctly', () => {
      const rules = [
        createMockRule({ name: 'Alpha' }),
        createMockRule({ name: 'Charlie' }),
        createMockRule({ name: 'Bravo' }),
      ];

      const result = sortRules(rules, RuleSortOrder.AlphaDesc);

      expect(result.map((r) => r.name)).toEqual(['Charlie', 'Bravo', 'Alpha']);
    });

    it('should be case insensitive', () => {
      const rules = [
        createMockRule({ name: 'charlie' }),
        createMockRule({ name: 'ALPHA' }),
        createMockRule({ name: 'Bravo' }),
      ];

      const result = sortRules(rules, RuleSortOrder.AlphaAsc);

      expect(result.map((r) => r.name)).toEqual(['ALPHA', 'Bravo', 'charlie']);
    });
  });

  describe('state sorting', () => {
    it('should sort by state with firing first', () => {
      const rules = [
        createAlertingRule('normal-rule', PromAlertingRuleState.Inactive),
        createAlertingRule('firing-rule', PromAlertingRuleState.Firing),
        createAlertingRule('pending-rule', PromAlertingRuleState.Pending),
      ];

      const result = sortRules(rules, RuleSortOrder.StateAsc);

      expect(result.map((r) => r.name)).toEqual(['firing-rule', 'pending-rule', 'normal-rule']);
    });

    it('should sort by state with normal first', () => {
      const rules = [
        createAlertingRule('firing-rule', PromAlertingRuleState.Firing),
        createAlertingRule('normal-rule', PromAlertingRuleState.Inactive),
        createAlertingRule('pending-rule', PromAlertingRuleState.Pending),
      ];

      const result = sortRules(rules, RuleSortOrder.StateDesc);

      expect(result.map((r) => r.name)).toEqual(['normal-rule', 'pending-rule', 'firing-rule']);
    });

    it('should use name as tiebreaker for same state', () => {
      const rules = [
        createAlertingRule('charlie-firing', PromAlertingRuleState.Firing),
        createAlertingRule('alpha-firing', PromAlertingRuleState.Firing),
        createAlertingRule('bravo-firing', PromAlertingRuleState.Firing),
      ];

      const result = sortRules(rules, RuleSortOrder.StateAsc);

      expect(result.map((r) => r.name)).toEqual(['alpha-firing', 'bravo-firing', 'charlie-firing']);
    });
  });

  describe('updated time sorting', () => {
    it('should sort by updated time with newest first', () => {
      const rules = [
        createGrafanaRule('old-rule', PromAlertingRuleState.Inactive, '2024-01-01T00:00:00Z'),
        createGrafanaRule('new-rule', PromAlertingRuleState.Inactive, '2024-03-01T00:00:00Z'),
        createGrafanaRule('mid-rule', PromAlertingRuleState.Inactive, '2024-02-01T00:00:00Z'),
      ];

      const result = sortRules(rules, RuleSortOrder.UpdatedDesc);

      expect(result.map((r) => r.name)).toEqual(['new-rule', 'mid-rule', 'old-rule']);
    });

    it('should sort by updated time with oldest first', () => {
      const rules = [
        createGrafanaRule('old-rule', PromAlertingRuleState.Inactive, '2024-01-01T00:00:00Z'),
        createGrafanaRule('new-rule', PromAlertingRuleState.Inactive, '2024-03-01T00:00:00Z'),
        createGrafanaRule('mid-rule', PromAlertingRuleState.Inactive, '2024-02-01T00:00:00Z'),
      ];

      const result = sortRules(rules, RuleSortOrder.UpdatedAsc);

      expect(result.map((r) => r.name)).toEqual(['old-rule', 'mid-rule', 'new-rule']);
    });
  });

  describe('created time sorting', () => {
    it('should sort by created time with newest first', () => {
      const rules = [
        createGrafanaRule('old-rule', PromAlertingRuleState.Inactive, '2024-01-01T00:00:00Z'),
        createGrafanaRule('new-rule', PromAlertingRuleState.Inactive, '2024-03-01T00:00:00Z'),
        createGrafanaRule('mid-rule', PromAlertingRuleState.Inactive, '2024-02-01T00:00:00Z'),
      ];

      const result = sortRules(rules, RuleSortOrder.CreatedDesc);

      expect(result.map((r) => r.name)).toEqual(['new-rule', 'mid-rule', 'old-rule']);
    });

    it('should sort by created time with oldest first', () => {
      const rules = [
        createGrafanaRule('old-rule', PromAlertingRuleState.Inactive, '2024-01-01T00:00:00Z'),
        createGrafanaRule('new-rule', PromAlertingRuleState.Inactive, '2024-03-01T00:00:00Z'),
        createGrafanaRule('mid-rule', PromAlertingRuleState.Inactive, '2024-02-01T00:00:00Z'),
      ];

      const result = sortRules(rules, RuleSortOrder.CreatedAsc);

      expect(result.map((r) => r.name)).toEqual(['old-rule', 'mid-rule', 'new-rule']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const result = sortRules([], RuleSortOrder.AlphaAsc);
      expect(result).toEqual([]);
    });

    it('should handle single item array', () => {
      const rules = [createMockRule({ name: 'only-rule' })];
      const result = sortRules(rules, RuleSortOrder.AlphaAsc);
      expect(result.map((r) => r.name)).toEqual(['only-rule']);
    });

    it('should handle rules without promRule for state sorting', () => {
      const rules = [
        createMockRule({ name: 'no-prom-rule' }),
        createAlertingRule('firing-rule', PromAlertingRuleState.Firing),
      ];

      const result = sortRules(rules, RuleSortOrder.StateAsc);

      expect(result.map((r) => r.name)).toEqual(['firing-rule', 'no-prom-rule']);
    });
  });
});
