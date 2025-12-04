import { testWithFeatureToggles } from 'test/test-utils';

import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { RuleHealth, RulesFilter } from '../search/rulesSearchParser';
import { getFilter } from '../utils/search';

import {
  FILTERED_GROUPS_LARGE_API_PAGE_SIZE,
  FILTERED_GROUPS_SMALL_API_PAGE_SIZE,
  RULE_LIMIT_WITH_BACKEND_FILTERS,
  getFilteredRulesLimits,
} from './paginationLimits';

describe('paginationLimits', () => {
  describe('getFilteredRulesLimits', () => {
    describe('when backend filters are disabled', () => {
      testWithFeatureToggles({ disable: ['alertingUIUseBackendFilters', 'alertingUIUseFullyCompatBackendFilters'] });

      it('should return small limits when no filters are applied', () => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter({}));

        expect(grafanaManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_SMALL_API_PAGE_SIZE });
        expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_SMALL_API_PAGE_SIZE });
      });

      it.each<Partial<RulesFilter>>([
        { ruleState: PromAlertingRuleState.Firing },
        { ruleHealth: RuleHealth.Ok },
        { contactPoint: 'slack' },
      ])('should return small grafana limit + large datasource limit for backend-only filter: %p', (filterState) => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter(filterState));

        expect(grafanaManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_SMALL_API_PAGE_SIZE });
        expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
      });

      it.each<Partial<RulesFilter>>([
        { freeFormWords: ['cpu'] },
        { ruleName: 'alert' },
        { ruleType: PromRuleType.Alerting },
        { dataSourceNames: ['prometheus'] },
        { labels: ['severity=critical'] },
        { dashboardUid: 'test-dashboard' },
        { plugins: 'hide' as const },
        { namespace: 'production' },
        { groupName: 'test-group' },
        { namespace: 'production', freeFormWords: ['cpu'] },
      ])('should return large limits for both when frontend filters are used: %p', (filterState) => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter(filterState));

        expect(grafanaManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
        expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
      });
    });

    describe('when alertingUIUseBackendFilters is enabled', () => {
      testWithFeatureToggles({ enable: ['alertingUIUseBackendFilters'] });

      it('should return rule limit for grafana + default limit for datasource when no filters are applied', () => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter({}));

        expect(grafanaManagedLimit).toEqual({ ruleLimit: RULE_LIMIT_WITH_BACKEND_FILTERS });
        expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_SMALL_API_PAGE_SIZE });
      });

      it.each<Partial<RulesFilter>>([
        { freeFormWords: ['cpu'] },
        { ruleName: 'alert' },
        { ruleType: PromRuleType.Alerting },
        { dashboardUid: 'test-dashboard' },
        { groupName: 'test-group' },
        { ruleState: PromAlertingRuleState.Firing },
        { ruleHealth: RuleHealth.Ok },
        { contactPoint: 'slack' },
        { dataSourceNames: ['prometheus'] },
      ])(
        'should return rule limit for grafana + large limit for datasource when only backend filters are used: %p',
        (filterState) => {
          const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter(filterState));

          expect(grafanaManagedLimit).toEqual({ ruleLimit: RULE_LIMIT_WITH_BACKEND_FILTERS });
          expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
        }
      );

      it.each<Partial<RulesFilter>>([
        { namespace: 'production' },
        { labels: ['severity=critical'] },
        { ruleState: PromAlertingRuleState.Firing, namespace: 'production' },
      ])('should return large limits for both when frontend filters are used: %p', (filterState) => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter(filterState));

        expect(grafanaManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
        expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
      });
    });

    describe('when alertingUIUseFullyCompatBackendFilters is enabled', () => {
      testWithFeatureToggles({ enable: ['alertingUIUseFullyCompatBackendFilters'] });

      it('should return rule limit for grafana + default limit for datasource when no filters are applied', () => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter({}));

        expect(grafanaManagedLimit).toEqual({ ruleLimit: RULE_LIMIT_WITH_BACKEND_FILTERS });
        expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_SMALL_API_PAGE_SIZE });
      });

      it.each<Partial<RulesFilter>>([
        { ruleType: PromRuleType.Alerting },
        { dashboardUid: 'test-dashboard' },
        { ruleState: PromAlertingRuleState.Firing },
        { ruleHealth: RuleHealth.Ok },
        { contactPoint: 'slack' },
        { dataSourceNames: ['prometheus'] },
      ])(
        'should return rule limit for grafana + large limit for datasource when only backend filters are used: %p',
        (filterState) => {
          const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter(filterState));

          expect(grafanaManagedLimit).toEqual({ ruleLimit: RULE_LIMIT_WITH_BACKEND_FILTERS });
          expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
        }
      );

      it.each<Partial<RulesFilter>>([
        { freeFormWords: ['cpu'] },
        { ruleName: 'alert' },
        { groupName: 'test-group' },
        { namespace: 'production' },
        { labels: ['severity=critical'] },
      ])('should return large limits for both when frontend filters are used: %p', (filterState) => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter(filterState));

        expect(grafanaManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
        expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
      });
    });

    describe('when both backend filter toggles are enabled', () => {
      testWithFeatureToggles({ enable: ['alertingUIUseBackendFilters', 'alertingUIUseFullyCompatBackendFilters'] });

      it('should return rule limit for grafana + default limit for datasource when no filters are applied', () => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter({}));

        expect(grafanaManagedLimit).toEqual({ ruleLimit: RULE_LIMIT_WITH_BACKEND_FILTERS });
        expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_SMALL_API_PAGE_SIZE });
      });

      it.each<Partial<RulesFilter>>([
        { freeFormWords: ['cpu'] },
        { ruleName: 'alert' },
        { ruleType: PromRuleType.Alerting },
        { dashboardUid: 'test-dashboard' },
        { groupName: 'test-group' },
        { ruleState: PromAlertingRuleState.Firing },
        { ruleHealth: RuleHealth.Ok },
        { contactPoint: 'slack' },
        { dataSourceNames: ['prometheus'] },
      ])(
        'should return rule limit for grafana + large limit for datasource when only backend filters are used: %p',
        (filterState) => {
          const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter(filterState));

          expect(grafanaManagedLimit).toEqual({ ruleLimit: RULE_LIMIT_WITH_BACKEND_FILTERS });
          expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
        }
      );

      it.each<Partial<RulesFilter>>([{ namespace: 'production' }, { labels: ['severity=critical'] }])(
        'should return large limits for both when frontend filters are used: %p',
        (filterState) => {
          const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter(filterState));

          expect(grafanaManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
          expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
        }
      );
    });
  });
});
