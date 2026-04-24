import { type DataFrame, FieldType } from '@grafana/data';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { countInstances, countRules } from './SummaryStats';

describe('countInstances', () => {
  it('should return zeros when required fields are missing', () => {
    const frame = { length: 0, fields: [] } as unknown as DataFrame;
    expect(countInstances(frame)).toEqual({ firing: 0, pending: 0 });
  });

  it('should return the Value for each alertstate', () => {
    const frame = {
      length: 2,
      fields: [
        { name: 'alertstate', type: FieldType.string, config: {}, values: ['firing', 'pending'] },
        { name: 'Value', type: FieldType.number, config: {}, values: [10, 3] },
      ],
    } as unknown as DataFrame;
    expect(countInstances(frame)).toEqual({ firing: 10, pending: 3 });
  });

  it('should return 0 for a state not present in the frame', () => {
    const frame = {
      length: 1,
      fields: [
        { name: 'alertstate', type: FieldType.string, config: {}, values: ['firing'] },
        { name: 'Value', type: FieldType.number, config: {}, values: [5] },
      ],
    } as unknown as DataFrame;
    expect(countInstances(frame)).toEqual({ firing: 5, pending: 0 });
  });

  it('should accept a Value #<refId> field name', () => {
    const frame = {
      length: 1,
      fields: [
        { name: 'alertstate', type: FieldType.string, config: {}, values: ['firing'] },
        { name: 'Value #B', type: FieldType.number, config: {}, values: [7] },
      ],
    } as unknown as DataFrame;
    expect(countInstances(frame)).toEqual({ firing: 7, pending: 0 });
  });
});

describe('countRules', () => {
  function createMockRuleFrame(
    data: Array<{ ruleUID: string; alertstate: PromAlertingRuleState.Firing | PromAlertingRuleState.Pending }>
  ): DataFrame {
    return {
      length: data.length,
      fields: [
        { name: 'grafana_rule_uid', type: FieldType.string, config: {}, values: data.map((d) => d.ruleUID) },
        { name: 'alertstate', type: FieldType.string, config: {}, values: data.map((d) => d.alertstate) },
      ],
    } as DataFrame;
  }

  it('should count rules by alertstate', () => {
    const frame = createMockRuleFrame([
      { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
      { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Firing },
      { ruleUID: 'rule3', alertstate: PromAlertingRuleState.Pending },
    ]);

    const result = countRules(frame);

    expect(result.firing).toBe(2);
    expect(result.pending).toBe(1);
  });

  it('should count rules with BOTH firing and pending in both counts', () => {
    const frame = createMockRuleFrame([
      { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
      { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Pending }, // Same rule, both states
      { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Firing }, // Only firing
      { ruleUID: 'rule3', alertstate: PromAlertingRuleState.Pending }, // Only pending
    ]);

    const result = countRules(frame);

    // rule1 has both states, so counted in both
    // rule2 counted only in firing
    // rule3 counted only in pending
    expect(result.firing).toBe(2); // rule1 and rule2
    expect(result.pending).toBe(2); // rule1 and rule3
  });

  it('should deduplicate multiple instances of the same rule', () => {
    const frame = createMockRuleFrame([
      { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
      { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
      { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Pending },
      { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Pending },
    ]);

    const result = countRules(frame);

    expect(result.firing).toBe(1);
    expect(result.pending).toBe(1);
  });

  it('should return 0 for both counts when no rules', () => {
    const frame = createMockRuleFrame([]);

    const result = countRules(frame);

    expect(result.firing).toBe(0);
    expect(result.pending).toBe(0);
  });

  it('should handle complex scenario with many rules', () => {
    const frame = createMockRuleFrame([
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

    const result = countRules(frame);
    expect(result.firing).toBe(3); // Rule A, C, and D
    expect(result.pending).toBe(3); // Rule B, C, and E
  });
});
