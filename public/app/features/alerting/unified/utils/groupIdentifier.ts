import { CombinedRule, RuleGroupIdentifier, RuleGroupIdentifierV2 } from 'app/types/unified-alerting';

import { GRAFANA_RULES_SOURCE_NAME, getDatasourceAPIUid, getRulesSourceName, isGrafanaRulesSource } from './datasource';
import { isGrafanaRulerRule } from './rules';

function fromCombinedRule(rule: CombinedRule): RuleGroupIdentifierV2 {
  if (isGrafanaRulerRule(rule.rulerRule) && isGrafanaRulesSource(rule.namespace.rulesSource)) {
    return {
      namespace: { uid: rule.rulerRule.grafana_alert.namespace_uid },
      groupName: rule.group.name,
      groupOrigin: 'grafana',
    };
  }

  const rulesSourceName = getRulesSourceName(rule.namespace.rulesSource);
  const rulesSourceUid = getDatasourceAPIUid(rulesSourceName);
  return {
    rulesSource: { uid: rulesSourceUid, name: rulesSourceName, ruleSourceType: 'datasource' },
    namespace: { name: rule.namespace.name },
    groupName: rule.group.name,
    groupOrigin: 'datasource',
  };
}

export function getGroupOriginName(groupIdentifier: RuleGroupIdentifierV2) {
  return groupIdentifier.groupOrigin === 'grafana' ? GRAFANA_RULES_SOURCE_NAME : groupIdentifier.rulesSource.name;
}

/** Helper function to convert RuleGroupIdentifier to RuleGroupIdentifierV2 */
export function ruleGroupIdentifierV2toV1(groupIdentifier: RuleGroupIdentifierV2): RuleGroupIdentifier {
  const rulesSourceName = getGroupOriginName(groupIdentifier);

  return {
    dataSourceName: rulesSourceName,
    namespaceName: 'uid' in groupIdentifier.namespace ? groupIdentifier.namespace.uid : groupIdentifier.namespace.name,
    groupName: groupIdentifier.groupName,
  };
}

export const groupIdentifier = {
  fromCombinedRule,
};
