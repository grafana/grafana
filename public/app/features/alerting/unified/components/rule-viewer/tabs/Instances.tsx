import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { type CombinedRule } from 'app/types/unified-alerting';

import { rulerRuleType } from '../../../utils/rules';
import { RuleDetailsMatchingInstances } from '../../rules/RuleDetailsMatchingInstances';

interface Props {
  rule: CombinedRule;
}

const InstancesList = ({ rule }: Props) => {
  const rulerRule = rule.rulerRule;
  const isGrafanaManagedUsingNotificationPolicies =
    rulerRuleType.grafana.alertingRule(rulerRule) && !rulerRule.grafana_alert.notification_settings?.receiver;

  return (
    <RuleDetailsMatchingInstances
      rule={rule}
      pagination={{ itemsPerPage: DEFAULT_PER_PAGE_PAGINATION }}
      enableFiltering
      showPreviewRouting={isGrafanaManagedUsingNotificationPolicies}
    />
  );
};

export { InstancesList };
