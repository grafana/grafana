import { PromRuleType } from 'app/types/unified-alerting-dto';

import { getFilter } from '../../utils/search';

import { buildTitleSearch, normalizeFilterState } from './filterNormalization';

describe('buildTitleSearch', () => {
  it('should return undefined when no title filters are provided', () => {
    expect(buildTitleSearch(getFilter({}))).toBeUndefined();
  });

  it('should return ruleName when only ruleName is provided', () => {
    expect(buildTitleSearch(getFilter({ ruleName: 'high cpu' }))).toBe('high cpu');
  });

  it('should return freeFormWords when only freeFormWords are provided', () => {
    expect(buildTitleSearch(getFilter({ freeFormWords: ['cpu', 'usage'] }))).toBe('cpu usage');
  });

  it('should combine ruleName and freeFormWords', () => {
    expect(buildTitleSearch(getFilter({ ruleName: 'alert', freeFormWords: ['cpu'] }))).toBe('alert cpu');
  });

  it('should trim whitespace from inputs', () => {
    expect(buildTitleSearch(getFilter({ ruleName: '  alert  ', freeFormWords: ['  cpu  ', '  usage  '] }))).toBe(
      'alert cpu usage'
    );
  });

  it('should filter out empty strings from freeFormWords', () => {
    expect(buildTitleSearch(getFilter({ freeFormWords: ['cpu', '', '  ', 'usage'] }))).toBe('cpu usage');
  });

  it('should return undefined when only empty strings are provided', () => {
    expect(buildTitleSearch(getFilter({ ruleName: '  ', freeFormWords: ['', '  '] }))).toBeUndefined();
  });
});

describe('normalizeFilterState', () => {
  it('should lowercase freeFormWords', () => {
    const result = normalizeFilterState(getFilter({ freeFormWords: ['CPU', 'Usage'] }));
    expect(result.freeFormWords).toEqual(['cpu', 'usage']);
  });

  it('should lowercase ruleName', () => {
    const result = normalizeFilterState(getFilter({ ruleName: 'High CPU' }));
    expect(result.ruleName).toBe('high cpu');
  });

  it('should lowercase groupName', () => {
    const result = normalizeFilterState(getFilter({ groupName: 'Production Alerts' }));
    expect(result.groupName).toBe('production alerts');
  });

  it('should lowercase namespace', () => {
    const result = normalizeFilterState(getFilter({ namespace: 'Production/Alerts' }));
    expect(result.namespace).toBe('production/alerts');
  });

  it('should handle undefined values', () => {
    const result = normalizeFilterState(getFilter({}));
    expect(result.ruleName).toBeUndefined();
    expect(result.groupName).toBeUndefined();
    expect(result.namespace).toBeUndefined();
  });

  it('should preserve other filter properties', () => {
    const result = normalizeFilterState(
      getFilter({
        ruleName: 'Alert',
        ruleType: PromRuleType.Alerting,
        labels: ['severity=critical'],
        dataSourceNames: ['prometheus'],
      })
    );
    expect(result.ruleType).toBe(PromRuleType.Alerting);
    expect(result.labels).toEqual(['severity=critical']);
    expect(result.dataSourceNames).toEqual(['prometheus']);
  });

  it('should lowercase all relevant fields in a complex filter', () => {
    const result = normalizeFilterState(
      getFilter({
        freeFormWords: ['CPU', 'Memory'],
        ruleName: 'High Usage',
        groupName: 'System Alerts',
        namespace: 'Production/Critical',
      })
    );
    expect(result.freeFormWords).toEqual(['cpu', 'memory']);
    expect(result.ruleName).toBe('high usage');
    expect(result.groupName).toBe('system alerts');
    expect(result.namespace).toBe('production/critical');
  });
});
