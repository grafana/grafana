import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';
import { type CombinedRule } from 'app/types/unified-alerting';

import { prometheusRuleType, rulerRuleType } from '../../../utils/rules';
import { RuleDetailsMatchingInstances } from '../../rules/RuleDetailsMatchingInstances';

interface Props {
  rule: CombinedRule;
}

const InstancesList = ({ rule }: Props) => {
  const isGrafanaAlertingRule =
    rulerRuleType.grafana.alertingRule(rule.rulerRule) || prometheusRuleType.grafana.alertingRule(rule.promRule);

  return (
    <RuleDetailsMatchingInstances
      rule={rule}
      pagination={{ itemsPerPage: DEFAULT_PER_PAGE_PAGINATION }}
      enableFiltering
      showSilenceAction={isGrafanaAlertingRule}
    />
  );
};

export { InstancesList };
