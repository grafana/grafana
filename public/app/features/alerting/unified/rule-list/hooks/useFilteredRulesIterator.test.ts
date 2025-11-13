import { config } from '@grafana/runtime';

import { RuleSource } from '../../search/rulesSearchParser';
import { getFilter } from '../../utils/search';

import { buildTitleSearch, hasClientSideFilters } from './useFilteredRulesIterator';

describe('hasClientSideFilters', () => {
  const originalFeatureToggles = config.featureToggles;

  beforeEach(() => {
    config.featureToggles = { ...originalFeatureToggles };
  });

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  describe('when alertingUIUseBackendFilters is enabled', () => {
    beforeEach(() => {
      config.featureToggles.alertingUIUseBackendFilters = true;
    });

    it('should return false for title search filters (backend-supported)', () => {
      expect(hasClientSideFilters(getFilter({ freeFormWords: ['cpu'] }))).toBe(false);
      expect(hasClientSideFilters(getFilter({ ruleName: 'test' }))).toBe(false);
    });

    it('should return true for client-side only filters', () => {
      expect(hasClientSideFilters(getFilter({ namespace: 'test' }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ dataSourceNames: ['prometheus'] }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ labels: ['severity=critical'] }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ dashboardUid: 'test-dashboard' }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ ruleSource: RuleSource.DataSource }))).toBe(true);
    });

    it('should return false when no filters are applied', () => {
      expect(hasClientSideFilters(getFilter({}))).toBe(false);
    });
  });

  describe('when alertingUIUseBackendFilters is disabled', () => {
    beforeEach(() => {
      config.featureToggles.alertingUIUseBackendFilters = false;
    });

    it('should return true for title search filters (client-side fallback)', () => {
      expect(hasClientSideFilters(getFilter({ freeFormWords: ['cpu'] }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ ruleName: 'test' }))).toBe(true);
    });

    it('should return true for client-side only filters', () => {
      expect(hasClientSideFilters(getFilter({ namespace: 'test' }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ dataSourceNames: ['prometheus'] }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ labels: ['severity=critical'] }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ dashboardUid: 'test-dashboard' }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ ruleSource: RuleSource.DataSource }))).toBe(true);
    });

    it('should return false when no filters are applied', () => {
      expect(hasClientSideFilters(getFilter({}))).toBe(false);
    });
  });

  describe('when alertingUIUseBackendFilters is undefined (default)', () => {
    beforeEach(() => {
      config.featureToggles.alertingUIUseBackendFilters = undefined;
    });

    it('should return true for title search filters (backward compatibility)', () => {
      // Default behavior should be client-side filtering
      expect(hasClientSideFilters(getFilter({ freeFormWords: ['cpu'] }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ ruleName: 'test' }))).toBe(true);
    });
  });
});

describe('buildTitleSearch', () => {
  it('returns undefined when no search terms are provided', () => {
    expect(buildTitleSearch(getFilter({}))).toBeUndefined();
  });

  it('returns the rule name when only a rule search is provided', () => {
    expect(buildTitleSearch(getFilter({ ruleName: 'cpu' }))).toBe('cpu');
  });

  it('returns joined free-form words when only text search is provided', () => {
    expect(buildTitleSearch(getFilter({ freeFormWords: ['cpu', 'memory'] }))).toBe('cpu memory');
  });

  it('concatenates rule search and free-form text when both are provided', () => {
    expect(buildTitleSearch(getFilter({ ruleName: 'cpu', freeFormWords: ['memory', 'latency'] }))).toBe(
      'cpu memory latency'
    );
  });
});
