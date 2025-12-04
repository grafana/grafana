import { DataFrameView } from '@grafana/data';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { RuleFrame, countRules, parseAlertstateFilter } from './SummaryStats';

describe('parseAlertstateFilter', () => {
  it('should return array with "firing" when filter contains alertstate="firing"', () => {
    expect(parseAlertstateFilter('alertstate="firing"')).toEqual([PromAlertingRuleState.Firing]);
  });

  it('should return array with "pending" when filter contains alertstate="pending"', () => {
    expect(parseAlertstateFilter('alertstate="pending"')).toEqual([PromAlertingRuleState.Pending]);
  });

  it('should return both states when filter contains both firing and pending', () => {
    expect(parseAlertstateFilter('alertstate=~"firing|pending"')).toEqual([
      PromAlertingRuleState.Firing,
      PromAlertingRuleState.Pending,
    ]);
  });

  it('should return both states when no alertstate filter', () => {
    expect(parseAlertstateFilter('')).toEqual([PromAlertingRuleState.Firing, PromAlertingRuleState.Pending]);
    expect(parseAlertstateFilter('namespace="default"')).toEqual([
      PromAlertingRuleState.Firing,
      PromAlertingRuleState.Pending,
    ]);
  });

  it('should handle regex operator =~', () => {
    expect(parseAlertstateFilter('alertstate=~"firing"')).toEqual([PromAlertingRuleState.Firing]);
    expect(parseAlertstateFilter('alertstate=~"pending"')).toEqual([PromAlertingRuleState.Pending]);
  });

  it('should handle whitespace', () => {
    expect(parseAlertstateFilter('alertstate = "firing"')).toEqual([PromAlertingRuleState.Firing]);
    expect(parseAlertstateFilter('alertstate =~ "pending"')).toEqual([PromAlertingRuleState.Pending]);
  });
});

describe('countRules', () => {
  // Helper to create mock DataFrameView
  function createMockRuleDfv(
    data: Array<{ ruleUID: string; alertstate: PromAlertingRuleState.Firing | PromAlertingRuleState.Pending }>
  ): DataFrameView<RuleFrame> {
    return {
      length: data.length,
      fields: {
        grafana_rule_uid: {
          values: data.map((d) => d.ruleUID),
        },
        alertstate: {
          values: data.map((d) => d.alertstate),
        },
      },
    } as unknown as DataFrameView<RuleFrame>;
  }

  describe('when no alertstate filter applied', () => {
    it('should count rules with ANY firing instances', () => {
      const ruleDfv = createMockRuleDfv([
        { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
        { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Firing },
        { ruleUID: 'rule3', alertstate: PromAlertingRuleState.Pending },
      ]);

      const result = countRules(ruleDfv, [PromAlertingRuleState.Firing, PromAlertingRuleState.Pending]);

      expect(result.firing).toBe(2);
      expect(result.pending).toBe(1);
    });

    it('should count rules with ONLY pending instances (no firing)', () => {
      const ruleDfv = createMockRuleDfv([
        { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Pending },
        { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Pending },
        { ruleUID: 'rule3', alertstate: PromAlertingRuleState.Firing },
      ]);

      const result = countRules(ruleDfv, [PromAlertingRuleState.Firing, PromAlertingRuleState.Pending]);

      expect(result.firing).toBe(1);
      expect(result.pending).toBe(2);
    });

    it('should count rules with BOTH firing and pending in both counts', () => {
      const ruleDfv = createMockRuleDfv([
        { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
        { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Pending }, // Same rule, both states
        { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Firing }, // Only firing
        { ruleUID: 'rule3', alertstate: PromAlertingRuleState.Pending }, // Only pending
      ]);

      const result = countRules(ruleDfv, [PromAlertingRuleState.Firing, PromAlertingRuleState.Pending]);

      // rule1 has both states, so counted in both
      // rule2 counted only in firing
      // rule3 counted only in pending
      expect(result.firing).toBe(2); // rule1 and rule2
      expect(result.pending).toBe(2); // rule1 and rule3
    });

    it('should handle multiple instances of the same rule with same state', () => {
      const ruleDfv = createMockRuleDfv([
        { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
        { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing }, // Same rule, duplicate entry
        { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Pending },
        { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Pending }, // Same rule, duplicate entry
      ]);

      const result = countRules(ruleDfv, [PromAlertingRuleState.Firing, PromAlertingRuleState.Pending]);

      // Each rule should only be counted once despite multiple entries
      expect(result.firing).toBe(1);
      expect(result.pending).toBe(1);
    });

    it('should return 0 for both counts when no rules', () => {
      const ruleDfv = createMockRuleDfv([]);

      const result = countRules(ruleDfv, [PromAlertingRuleState.Firing, PromAlertingRuleState.Pending]);

      expect(result.firing).toBe(0);
      expect(result.pending).toBe(0);
    });
  });

  describe('when filtering by alertstate=pending', () => {
    it('should count ALL rules with any pending instances', () => {
      const ruleDfv = createMockRuleDfv([
        { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
        { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Pending }, // Has both
        { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Pending }, // Only pending
        { ruleUID: 'rule3', alertstate: PromAlertingRuleState.Firing }, // Only firing
      ]);

      const result = countRules(ruleDfv, [PromAlertingRuleState.Pending]);

      // Should count rule1 and rule2 (both have pending instances)
      expect(result.pending).toBe(2);
      expect(result.firing).toBe(0);
    });

    it('should count rules with BOTH states as pending', () => {
      const ruleDfv = createMockRuleDfv([
        { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
        { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Pending },
        { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Firing },
        { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Pending },
        { ruleUID: 'rule3', alertstate: PromAlertingRuleState.Pending },
      ]);

      const result = countRules(ruleDfv, [PromAlertingRuleState.Pending]);

      // Should count all three rules (all have pending instances)
      expect(result.pending).toBe(3);
      expect(result.firing).toBe(0);
    });

    it('should be >= pending count from no filter scenario', () => {
      const ruleDfv = createMockRuleDfv([
        { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
        { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Pending },
        { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Pending },
      ]);

      const noFilterResult = countRules(ruleDfv, [PromAlertingRuleState.Firing, PromAlertingRuleState.Pending]);
      const pendingFilterResult = countRules(ruleDfv, [PromAlertingRuleState.Pending]);

      // With pending filter: should count rule1 and rule2 = 2
      // Without filter: should also count both rules = 2 (both have pending instances)
      expect(pendingFilterResult.pending).toBe(2);
      expect(noFilterResult.pending).toBe(2); // Both rule1 and rule2 have pending instances
      expect(noFilterResult.firing).toBe(1); // rule1
    });
  });

  describe('when filtering by alertstate=firing', () => {
    it('should count ALL rules with any firing instances', () => {
      const ruleDfv = createMockRuleDfv([
        { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
        { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Pending }, // Has both
        { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Firing }, // Only firing
        { ruleUID: 'rule3', alertstate: PromAlertingRuleState.Pending }, // Only pending
      ]);

      const result = countRules(ruleDfv, [PromAlertingRuleState.Firing]);

      // Should count rule1 and rule2 (both have firing instances)
      expect(result.firing).toBe(2);
      expect(result.pending).toBe(0);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle complex scenario with many rules', () => {
      const ruleDfv = createMockRuleDfv([
        // Rule A: Only firing (3 instances)
        { ruleUID: 'ruleA', alertstate: PromAlertingRuleState.Firing },
        { ruleUID: 'ruleA', alertstate: PromAlertingRuleState.Firing },
        { ruleUID: 'ruleA', alertstate: PromAlertingRuleState.Firing },
        // Rule B: Only pending (2 instances)
        { ruleUID: 'ruleB', alertstate: PromAlertingRuleState.Pending },
        { ruleUID: 'ruleB', alertstate: PromAlertingRuleState.Pending },
        // Rule C: Both firing and pending (4 instances)
        { ruleUID: 'ruleC', alertstate: PromAlertingRuleState.Firing },
        { ruleUID: 'ruleC', alertstate: PromAlertingRuleState.Firing },
        { ruleUID: 'ruleC', alertstate: PromAlertingRuleState.Pending },
        { ruleUID: 'ruleC', alertstate: PromAlertingRuleState.Pending },
        // Rule D: Only firing (1 instance)
        { ruleUID: 'ruleD', alertstate: PromAlertingRuleState.Firing },
        // Rule E: Only pending (1 instance)
        { ruleUID: 'ruleE', alertstate: PromAlertingRuleState.Pending },
      ]);

      // No filter: Count all rules with at least one instance in each state
      const noFilter = countRules(ruleDfv, [PromAlertingRuleState.Firing, PromAlertingRuleState.Pending]);
      expect(noFilter.firing).toBe(3); // Rule A, C, and D (all have at least one firing instance)
      expect(noFilter.pending).toBe(3); // Rule B, C, and E (all have at least one pending instance)

      // With pending filter: Count all rules with ANY pending instances
      const pendingFilter = countRules(ruleDfv, [PromAlertingRuleState.Pending]);
      expect(pendingFilter.pending).toBe(3); // Rule B, C, and E
      expect(pendingFilter.firing).toBe(0);

      // With firing filter: Count all rules with ANY firing instances
      const firingFilter = countRules(ruleDfv, [PromAlertingRuleState.Firing]);
      expect(firingFilter.firing).toBe(3); // Rule A, C, and D
      expect(firingFilter.pending).toBe(0);
    });
  });
});
