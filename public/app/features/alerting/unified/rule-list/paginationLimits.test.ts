import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { RuleHealth, type RulesFilter } from '../search/rulesSearchParser';
import { getFilter } from '../utils/search';

import {
  FILTERED_GROUPS_LARGE_API_PAGE_SIZE,
  FILTERED_GROUPS_SMALL_API_PAGE_SIZE,
  RULE_LIMIT_WITH_BACKEND_FILTERS,
  getFilteredRulesLimits,
} from './paginationLimits';

describe('paginationLimits', () => {
  describe('getFilteredRulesLimits', () => {
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
      { labels: ['severity=critical'] },
      { namespace: 'production' },
    ])(
      'should return rule limit for grafana + large limit for datasource when only backend filters are used: %p',
      (filterState) => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter(filterState));

        expect(grafanaManagedLimit).toEqual({ ruleLimit: RULE_LIMIT_WITH_BACKEND_FILTERS });
        expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
      }
    );

    it('should return large grafana group limit when policy filter (frontend-only) is used', () => {
      const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(
        getFilter({ policy: 'my-policy' })
      );

      expect(grafanaManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
      expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_SMALL_API_PAGE_SIZE });
    });
  });
});
