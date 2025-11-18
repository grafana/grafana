import { config } from '@grafana/runtime';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { RuleSource } from '../../search/rulesSearchParser';
import { getFilter } from '../../utils/search';

import { hasClientSideFilters } from './useFilteredRulesIterator';

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

    it('should return false for backend-supported filters', () => {
      expect(hasClientSideFilters(getFilter({ freeFormWords: ['cpu'] }))).toBe(false);
      expect(hasClientSideFilters(getFilter({ ruleName: 'test' }))).toBe(false);
      expect(hasClientSideFilters(getFilter({ ruleType: PromRuleType.Alerting }))).toBe(false);
      expect(hasClientSideFilters(getFilter({ dashboardUid: 'test-dashboard' }))).toBe(false);
      expect(hasClientSideFilters(getFilter({ groupName: 'my-group' }))).toBe(false);
    });

    it('should return true for client-side only filters', () => {
      expect(hasClientSideFilters(getFilter({ namespace: 'test' }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ dataSourceNames: ['prometheus'] }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ labels: ['severity=critical'] }))).toBe(true);
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

    it('should return true for backend-supported filters when backend filtering is disabled', () => {
      expect(hasClientSideFilters(getFilter({ freeFormWords: ['cpu'] }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ ruleName: 'test' }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ ruleType: PromRuleType.Alerting }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ dashboardUid: 'test-dashboard' }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ groupName: 'my-group' }))).toBe(true);
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

    it('should default to client-side filtering for backward compatibility', () => {
      // Default behavior should be client-side filtering
      expect(hasClientSideFilters(getFilter({ freeFormWords: ['cpu'] }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ ruleName: 'test' }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ ruleType: PromRuleType.Alerting }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ dashboardUid: 'test-dashboard' }))).toBe(true);
      expect(hasClientSideFilters(getFilter({ groupName: 'my-group' }))).toBe(true);
    });
  });
});
