import {
  CloudRuleIdentifier,
  CombinedRule,
  PrometheusRuleIdentifier,
  RuleGroupIdentifier,
  RuleGroupIdentifierV2,
} from 'app/types/unified-alerting';

import { GRAFANA_RULES_SOURCE_NAME, getDatasourceAPIUid, getRulesSourceName, isGrafanaRulesSource } from './datasource';
import { rulerRuleType } from './rules';

function fromCombinedRule(rule: CombinedRule): RuleGroupIdentifierV2 {
  if (rulerRuleType.grafana.rule(rule.rulerRule) && isGrafanaRulesSource(rule.namespace.rulesSource)) {
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

function fromRuleIdentifier(ruleIdentifier: PrometheusRuleIdentifier | CloudRuleIdentifier): RuleGroupIdentifierV2 {
  return {
    rulesSource: {
      ruleSourceType: 'datasource',
      name: ruleIdentifier.ruleSourceName,
      uid: getDatasourceAPIUid(ruleIdentifier.ruleSourceName),
    },
    namespace: { name: ruleIdentifier.namespace },
    groupName: ruleIdentifier.groupName,
    groupOrigin: 'datasource',
  };
}

export const groupIdentifier = {
  fromCombinedRule,
  fromRuleIdentifier,
};
