import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import type { RuleHealth } from '../../search/rulesSearchParser';

export type AdvancedFilters = {
  namespace?: string | null;
  groupName?: string | null;
  ruleName?: string;
  ruleType?: PromRuleType | '*';
  ruleState: PromAlertingRuleState | '*';
  dataSourceNames: string[];
  labels: string[];
  ruleHealth?: RuleHealth | '*';
  dashboardUid?: string;
  plugins?: 'show' | 'hide';
  contactPoint?: string | null;
};
