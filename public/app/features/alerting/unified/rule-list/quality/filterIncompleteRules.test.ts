import { type IncompleteRule } from '../../hooks/useIncompleteRules';
import { type RulesFilter } from '../../search/rulesSearchParser';
import { Annotation } from '../../utils/constants';

import { filterIncompleteRules } from './filterIncompleteRules';

function makeFilter(partial: Partial<RulesFilter> = {}): RulesFilter {
  return {
    freeFormWords: [],
    dataSourceNames: [],
    labels: [],
    ...partial,
  };
}

const rules: IncompleteRule[] = [
  {
    uid: '1',
    name: 'High CPU',
    folder: 'Quality Demo',
    group: 'cpu_group',
    labels: { severity: 'warning', team: 'infra' },
    missing: [Annotation.summary, Annotation.description],
  },
  {
    uid: '2',
    name: 'Memory pressure',
    folder: 'Quality Demo',
    group: 'mem_group',
    labels: { severity: 'critical', team: 'infra' },
    missing: [Annotation.runbookURL],
  },
  {
    uid: '3',
    name: 'Payment decline spike',
    folder: 'Payments Team',
    group: 'payments_group',
    labels: { severity: 'critical', team: 'payments' },
    missing: [Annotation.summary],
  },
];

describe('filterIncompleteRules', () => {
  it('returns all rules when the filter is empty', () => {
    expect(filterIncompleteRules(rules, makeFilter())).toEqual(rules);
  });

  it('filters by folder (namespace) with exact match', () => {
    const result = filterIncompleteRules(rules, makeFilter({ namespace: 'Quality Demo' }));
    expect(result.map((r) => r.name)).toEqual(['High CPU', 'Memory pressure']);
  });

  it('filters by group name', () => {
    const result = filterIncompleteRules(rules, makeFilter({ groupName: 'payments_group' }));
    expect(result.map((r) => r.name)).toEqual(['Payment decline spike']);
  });

  it('filters by rule name (case-insensitive substring)', () => {
    const result = filterIncompleteRules(rules, makeFilter({ ruleName: 'memory' }));
    expect(result.map((r) => r.name)).toEqual(['Memory pressure']);
  });

  it('filters by free-form words against the rule name', () => {
    const result = filterIncompleteRules(rules, makeFilter({ freeFormWords: ['payment'] }));
    expect(result.map((r) => r.name)).toEqual(['Payment decline spike']);
  });

  it('filters by a single label matcher (key=value)', () => {
    const result = filterIncompleteRules(rules, makeFilter({ labels: ['team=payments'] }));
    expect(result.map((r) => r.name)).toEqual(['Payment decline spike']);
  });

  it('filters by a negated label matcher (key!=value)', () => {
    const result = filterIncompleteRules(rules, makeFilter({ labels: ['team!=infra'] }));
    expect(result.map((r) => r.name)).toEqual(['Payment decline spike']);
  });

  it('requires every label matcher to match (AND semantics)', () => {
    const result = filterIncompleteRules(rules, makeFilter({ labels: ['severity=critical', 'team=infra'] }));
    expect(result.map((r) => r.name)).toEqual(['Memory pressure']);
  });

  it('combines folder and label filters', () => {
    const result = filterIncompleteRules(
      rules,
      makeFilter({ namespace: 'Quality Demo', labels: ['severity=critical'] })
    );
    expect(result.map((r) => r.name)).toEqual(['Memory pressure']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterIncompleteRules(rules, makeFilter({ namespace: 'Nonexistent' }))).toEqual([]);
  });
});
