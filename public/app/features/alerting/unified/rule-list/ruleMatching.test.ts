import { alertingFactory } from '../mocks/server/db';

import { getMatchingPromRule, getMatchingRulerRule, matchRulesGroup } from './ruleMatching';

describe('getMatchingRulerRule', () => {
  it('should match rule by unique name', () => {
    // Create a ruler rule group with a single rule
    const rulerRule = alertingFactory.ruler.alertingRule.build({ alert: 'test-rule' });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

    // Create a matching prom rule with same name
    const promRule = alertingFactory.prometheus.rule.build({ name: 'test-rule' });

    const match = getMatchingRulerRule(rulerGroup, promRule);
    expect(match).toBe(rulerRule);
  });

  it('should not match when names are different', () => {
    const rulerRule = alertingFactory.ruler.alertingRule.build({
      alert: 'test-rule-1',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

    // Create a prom rule with different name but same labels/annotations
    const promRule = alertingFactory.prometheus.rule.build({
      name: 'test-rule-2',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });

    const match = getMatchingRulerRule(rulerGroup, promRule);
    expect(match).toBeUndefined();
  });

  it('should match by labels and annotations when multiple rules have same name', () => {
    // Create two ruler rules with same name but different labels
    const rulerRule1 = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });
    const rulerRule2 = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'critical' },
      annotations: { summary: 'different' },
    });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2] });

    // Create a matching prom rule with same name and matching labels
    const promRule = alertingFactory.prometheus.rule.build({
      name: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });

    const match = getMatchingRulerRule(rulerGroup, promRule);
    expect(match).toBe(rulerRule1);
  });

  it('should match by query when multiple rules have same name and labels', () => {
    // Create two ruler rules with same name and labels but different queries
    const rulerRule1 = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      expr: 'up == 1',
    });
    const rulerRule2 = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      expr: 'up == 0',
    });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2] });

    // Create a matching prom rule with same name, labels, and query
    const promRule = alertingFactory.prometheus.rule.build({
      name: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      query: 'up == 1',
    });

    const match = getMatchingRulerRule(rulerGroup, promRule);
    expect(match).toBe(rulerRule1);
  });

  it('should return undefined when rules differ only in the query part', () => {
    // Create two ruler rules with same name but different labels and queries
    const rulerRule1 = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      expr: 'up == 1',
    });
    const rulerRule2 = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'critical' },
      annotations: { summary: 'different' },
      expr: 'up == 0',
    });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2] });

    // Create a prom rule with same name but non-matching labels and query
    const promRule = alertingFactory.prometheus.rule.build({
      name: 'same-name',
      labels: { severity: 'error' },
      annotations: { summary: 'other' },
      query: 'up == 2',
    });

    const match = getMatchingRulerRule(rulerGroup, promRule);
    expect(match).toBeUndefined();
  });
});

describe('getMatchingPromRule', () => {
  it('should match rule by unique name', () => {
    // Create a prom rule group with a single rule
    const promRule = alertingFactory.prometheus.rule.build({ name: 'test-rule' });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule] });

    // Create a matching ruler rule with same name
    const rulerRule = alertingFactory.ruler.alertingRule.build({ alert: 'test-rule' });

    const match = getMatchingPromRule(promGroup, rulerRule);
    expect(match).toBe(promRule);
  });

  it('should not match when names are different', () => {
    const promRule = alertingFactory.prometheus.rule.build({
      name: 'test-rule-1',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule] });

    // Create a ruler rule with different name but same labels/annotations
    const rulerRule = alertingFactory.ruler.alertingRule.build({
      alert: 'test-rule-2',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });

    const match = getMatchingPromRule(promGroup, rulerRule);
    expect(match).toBeUndefined();
  });

  it('should match by labels and annotations when multiple rules have same name', () => {
    // Create two prom rules with same name but different labels
    const promRule1 = alertingFactory.prometheus.rule.build({
      name: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });
    const promRule2 = alertingFactory.prometheus.rule.build({
      name: 'same-name',
      labels: { severity: 'critical' },
      annotations: { summary: 'different' },
    });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule1, promRule2] });

    // Create a matching ruler rule with same name and matching labels
    const rulerRule = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });

    const match = getMatchingPromRule(promGroup, rulerRule);
    expect(match).toBe(promRule1);
  });

  it('should match by query when multiple rules have same name and labels', () => {
    // Create two prom rules with same name and labels but different queries
    const promRule1 = alertingFactory.prometheus.rule.build({
      name: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      query: 'up == 1',
    });
    const promRule2 = alertingFactory.prometheus.rule.build({
      name: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      query: 'up == 0',
    });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule1, promRule2] });

    // Create a matching ruler rule with same name, labels, and expression
    const rulerRule = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      expr: 'up == 1',
    });

    const match = getMatchingPromRule(promGroup, rulerRule);
    expect(match).toBe(promRule1);
  });

  it('should return undefined when rules differ only in the query part', () => {
    // Create two prom rules with same name but different labels and queries
    const promRule1 = alertingFactory.prometheus.rule.build({
      name: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      query: 'up == 1',
    });
    const promRule2 = alertingFactory.prometheus.rule.build({
      name: 'same-name',
      labels: { severity: 'critical' },
      annotations: { summary: 'different' },
      query: 'up == 0',
    });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule1, promRule2] });

    // Create a ruler rule with same name but non-matching labels and expression
    const rulerRule = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'error' },
      annotations: { summary: 'other' },
      expr: 'up == 2',
    });

    const match = getMatchingPromRule(promGroup, rulerRule);
    expect(match).toBeUndefined();
  });
});

describe('matchRulesGroup', () => {
  it('should match all rules when both groups have the same rules', () => {
    // Create ruler rules
    const rulerRule1 = alertingFactory.ruler.alertingRule.build({
      alert: 'rule-1',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });
    const rulerRule2 = alertingFactory.ruler.alertingRule.build({
      alert: 'rule-2',
      labels: { severity: 'critical' },
      annotations: { summary: 'test' },
    });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2] });

    // Create matching prom rules
    const promRule1 = alertingFactory.prometheus.rule.build({
      name: 'rule-1',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });
    const promRule2 = alertingFactory.prometheus.rule.build({
      name: 'rule-2',
      labels: { severity: 'critical' },
      annotations: { summary: 'test' },
    });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule1, promRule2] });

    const result = matchRulesGroup(rulerGroup, promGroup);

    // All rules should be matched
    expect(result.matches.size).toBe(2);
    expect(result.matches.get(rulerRule1)).toBe(promRule1);
    expect(result.matches.get(rulerRule2)).toBe(promRule2);
    expect(result.promOnlyRules).toHaveLength(0);
  });

  it('should handle ruler group having more rules than prom group', () => {
    // Create ruler rules (3 rules)
    const rulerRule1 = alertingFactory.ruler.alertingRule.build({
      alert: 'rule-1',
      labels: { severity: 'warning' },
    });
    const rulerRule2 = alertingFactory.ruler.alertingRule.build({
      alert: 'rule-2',
      labels: { severity: 'critical' },
    });
    const rulerRule3 = alertingFactory.ruler.alertingRule.build({
      alert: 'rule-3',
      labels: { severity: 'error' },
    });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2, rulerRule3] });

    // Create matching prom rules (only 2 rules)
    const promRule1 = alertingFactory.prometheus.rule.build({
      name: 'rule-1',
      labels: { severity: 'warning' },
    });
    const promRule2 = alertingFactory.prometheus.rule.build({
      name: 'rule-2',
      labels: { severity: 'critical' },
    });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule1, promRule2] });

    const result = matchRulesGroup(rulerGroup, promGroup);

    // Only 2 rules should be matched
    expect(result.matches.size).toBe(2);
    expect(result.matches.get(rulerRule1)).toBe(promRule1);
    expect(result.matches.get(rulerRule2)).toBe(promRule2);
    expect(result.matches.get(rulerRule3)).toBeUndefined();
    expect(result.promOnlyRules).toHaveLength(0);
  });

  it('should handle prom group having more rules than ruler group', () => {
    // Create ruler rules (2 rules)
    const rulerRule1 = alertingFactory.ruler.alertingRule.build({
      alert: 'rule-1',
      labels: { severity: 'warning' },
    });
    const rulerRule2 = alertingFactory.ruler.alertingRule.build({
      alert: 'rule-2',
      labels: { severity: 'critical' },
    });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2] });

    // Create matching prom rules (3 rules)
    const promRule1 = alertingFactory.prometheus.rule.build({
      name: 'rule-1',
      labels: { severity: 'warning' },
    });
    const promRule2 = alertingFactory.prometheus.rule.build({
      name: 'rule-2',
      labels: { severity: 'critical' },
    });
    const promRule3 = alertingFactory.prometheus.rule.build({
      name: 'rule-3',
      labels: { severity: 'error' },
    });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule1, promRule2, promRule3] });

    const result = matchRulesGroup(rulerGroup, promGroup);

    // 2 rules should be matched, 1 should be in promOnlyRules
    expect(result.matches.size).toBe(2);
    expect(result.matches.get(rulerRule1)).toBe(promRule1);
    expect(result.matches.get(rulerRule2)).toBe(promRule2);
    expect(result.promOnlyRules).toHaveLength(1);
    expect(result.promOnlyRules[0]).toBe(promRule3);
  });
});
