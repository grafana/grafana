import { CombinedRule, GrafanaRulesSourceSymbol, RuleGroupIdentifierV2 } from 'app/types/unified-alerting';

import { GRAFANA_RULES_SOURCE_NAME, getDatasourceAPIUid, getRulesSourceName, isGrafanaRulesSource } from './datasource';
import { isGrafanaRulerRule } from './rules';

function fromCombinedRule(rule: CombinedRule): RuleGroupIdentifierV2 {
  if (isGrafanaRulerRule(rule.rulerRule) && isGrafanaRulesSource(rule.namespace.rulesSource)) {
    return {
      rulesSource: { uid: GrafanaRulesSourceSymbol, name: GRAFANA_RULES_SOURCE_NAME },
      namespace: { uid: rule.rulerRule.grafana_alert.namespace_uid },
      groupName: rule.group.name,
      groupOrigin: 'grafana',
    };
  }

  const rulesSourceName = getRulesSourceName(rule.namespace.rulesSource);
  const rulesSourceUid = getDatasourceAPIUid(rulesSourceName);
  return {
    rulesSource: { uid: rulesSourceUid, name: rulesSourceName },
    namespace: { name: rule.namespace.name },
    groupName: rule.group.name,
    groupOrigin: 'datasource',
  };
}

export const groupIdentifier = {
  fromCombinedRule,
};
