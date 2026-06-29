import { type IncompleteRule } from '../../hooks/useIncompleteRules';
import { Annotation } from '../../utils/constants';

import { filterFindings, getFindingTypeCounts, getRuleSeverity } from './qualityFindingFilters';

function makeRule(partial: Partial<IncompleteRule> = {}): IncompleteRule {
  return {
    uid: '1',
    name: 'A rule',
    folder: 'Folder',
    group: 'Group',
    labels: {},
    missing: [Annotation.summary],
    ...partial,
  };
}

const summaryOnly = makeRule({ uid: '1', missing: [Annotation.summary] });
const descriptionOnly = makeRule({ uid: '2', missing: [Annotation.description] });
const runbookOnly = makeRule({ uid: '3', missing: [Annotation.runbookURL] });
const summaryAndDescription = makeRule({ uid: '4', missing: [Annotation.summary, Annotation.description] });
const allMissing = makeRule({
  uid: '5',
  missing: [Annotation.summary, Annotation.description, Annotation.runbookURL],
});

const rules = [summaryOnly, descriptionOnly, runbookOnly, summaryAndDescription, allMissing];

describe('getRuleSeverity', () => {
  it('returns high when the runbook URL is missing', () => {
    expect(getRuleSeverity(runbookOnly)).toBe('high');
    expect(getRuleSeverity(allMissing)).toBe('high');
  });

  it('returns medium when only summary/description are missing', () => {
    expect(getRuleSeverity(summaryOnly)).toBe('medium');
    expect(getRuleSeverity(descriptionOnly)).toBe('medium');
    expect(getRuleSeverity(summaryAndDescription)).toBe('medium');
  });
});

describe('getFindingTypeCounts', () => {
  it('counts each finding type independently, including rules missing several', () => {
    const counts = getFindingTypeCounts(rules);

    expect(counts[Annotation.summary]).toBe(3); // summaryOnly, summaryAndDescription, allMissing
    expect(counts[Annotation.description]).toBe(3); // descriptionOnly, summaryAndDescription, allMissing
    expect(counts[Annotation.runbookURL]).toBe(2); // runbookOnly, allMissing
  });

  it('returns zeroes for an empty list', () => {
    const counts = getFindingTypeCounts([]);

    expect(counts[Annotation.summary]).toBe(0);
    expect(counts[Annotation.description]).toBe(0);
    expect(counts[Annotation.runbookURL]).toBe(0);
  });
});

describe('filterFindings', () => {
  it('returns all rules when both filters are "all"', () => {
    expect(filterFindings(rules, { severity: 'all', findingType: 'all' })).toEqual(rules);
  });

  it('filters by high severity (missing runbook URL)', () => {
    const result = filterFindings(rules, { severity: 'high', findingType: 'all' });
    expect(result).toEqual([runbookOnly, allMissing]);
  });

  it('filters by medium severity (no missing runbook URL)', () => {
    const result = filterFindings(rules, { severity: 'medium', findingType: 'all' });
    expect(result).toEqual([summaryOnly, descriptionOnly, summaryAndDescription]);
  });

  it('returns an empty list for low severity (none exist yet)', () => {
    expect(filterFindings(rules, { severity: 'low', findingType: 'all' })).toEqual([]);
  });

  it('filters by finding type', () => {
    const result = filterFindings(rules, { severity: 'all', findingType: Annotation.description });
    expect(result).toEqual([descriptionOnly, summaryAndDescription, allMissing]);
  });

  it('combines severity and finding type with AND', () => {
    const result = filterFindings(rules, { severity: 'high', findingType: Annotation.description });
    expect(result).toEqual([allMissing]);
  });
});
