import { type IncompleteRule } from '../../hooks/useIncompleteRules';
import { Annotation } from '../../utils/constants';

import { filterFindings, getFindingTypeCounts, getRuleSeverity, getSeverityCounts } from './qualityFindingFilters';

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

describe('getSeverityCounts', () => {
  it('counts rules per severity tier', () => {
    const counts = getSeverityCounts(rules);

    expect(counts.high).toBe(2); // runbookOnly, allMissing
    expect(counts.medium).toBe(3); // summaryOnly, descriptionOnly, summaryAndDescription
    expect(counts.low).toBe(0);
  });

  it('returns zeroes for an empty list', () => {
    expect(getSeverityCounts([])).toEqual({ high: 0, medium: 0, low: 0 });
  });
});

describe('filterFindings', () => {
  it('returns all rules when no filters are active', () => {
    expect(filterFindings(rules, { severity: 'all', findingTypes: [] })).toEqual(rules);
  });

  it('filters by high severity (missing runbook URL)', () => {
    const result = filterFindings(rules, { severity: 'high', findingTypes: [] });
    expect(result).toEqual([runbookOnly, allMissing]);
  });

  it('filters by medium severity (no missing runbook URL)', () => {
    const result = filterFindings(rules, { severity: 'medium', findingTypes: [] });
    expect(result).toEqual([summaryOnly, descriptionOnly, summaryAndDescription]);
  });

  it('returns an empty list for low severity (none exist yet)', () => {
    expect(filterFindings(rules, { severity: 'low', findingTypes: [] })).toEqual([]);
  });

  it('filters by a single finding type', () => {
    const result = filterFindings(rules, { severity: 'all', findingTypes: [Annotation.description] });
    expect(result).toEqual([descriptionOnly, summaryAndDescription, allMissing]);
  });

  it('ORs multiple finding types together', () => {
    const result = filterFindings(rules, {
      severity: 'all',
      findingTypes: [Annotation.summary, Annotation.runbookURL],
    });
    // Every rule except descriptionOnly is missing a summary or a runbook URL.
    expect(result).toEqual([summaryOnly, runbookOnly, summaryAndDescription, allMissing]);
  });

  it('combines severity and finding type with AND', () => {
    const result = filterFindings(rules, { severity: 'high', findingTypes: [Annotation.description] });
    expect(result).toEqual([allMissing]);
  });
});
