import { type MatcherScope } from '@grafana/schema';

import { buildScopeOptions } from './MatcherScopeSelector';

describe('buildScopeOptions', () => {
  it('returns series as first option and other scopes from provided set (series not duplicated)', () => {
    const result = buildScopeOptions(new Set(['series', 'nested']));
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      label: 'Dataframe',
      description: 'Fields from the dataframes in this panel.',
      value: 'series',
    });
    expect(result[1]).toEqual({
      label: 'Nested',
      description: 'Fields from nested dataframes.',
      value: 'nested',
    });
  });

  it('returns only series option when providedUniqScopes is empty', () => {
    const result = buildScopeOptions(new Set());
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('series');
  });

  it('returns only series option when providedUniqScopes contains only series', () => {
    const result = buildScopeOptions(new Set(['series']));
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('series');
  });

  it('filters scopes by allowedScopes when provided', () => {
    const result = buildScopeOptions(new Set(['series', 'nested', 'annotation']), undefined, ['series', 'nested']);
    const values = result.map((o) => o.value);
    expect(values).toContain('series');
    expect(values).toContain('nested');
    expect(values).not.toContain('annotation');
  });

  it('includes currentScope when it is not in providedUniqScopes (e.g. saved scope no longer in data)', () => {
    const result = buildScopeOptions(new Set(['series']), 'annotation');
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe('series');
    expect(result[1]).toEqual({
      label: 'Annotations',
      description: 'Annotations series for this panel.',
      value: 'annotation',
    });
  });

  it('does not add currentScope when it is series (series is always first)', () => {
    const result = buildScopeOptions(new Set(['nested']), 'series');
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe('series');
    expect(result[1].value).toBe('nested');
  });

  it('does not duplicate currentScope when it is already in providedUniqScopes', () => {
    const result = buildScopeOptions(new Set(['series', 'nested']), 'nested');
    expect(result).toHaveLength(2);
    expect(result.filter((o) => o.value === 'nested')).toHaveLength(1);
  });

  it('defaults allowedScopes to all provided scopes when not passed', () => {
    const result = buildScopeOptions(new Set(['series', 'nested', 'annotation']));
    const values = result.map((o) => o.value);
    expect(values).toEqual(['series', 'nested', 'annotation']);
  });

  it('each option has label, description and value', () => {
    const inputSet = new Set<MatcherScope>(['series', 'nested', 'annotation', 'exemplar']);
    const result = buildScopeOptions(inputSet);
    expect(result).toHaveLength(inputSet.size);
    for (const option of result) {
      expect(option.value).toBeDefined();
      expect(option.label).toBeDefined();
      expect(option.description).toBeDefined();
    }
  });
});
