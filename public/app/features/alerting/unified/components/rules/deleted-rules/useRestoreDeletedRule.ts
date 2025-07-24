import { useAsync } from 'app/features/alerting/unified/hooks/useAsync';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { GrafanaRuleDefinition, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { useAddRuleToRuleGroup } from '../../../hooks/ruleGroup/useUpsertRuleFromRuleGroup';

export function useRestoreDeletedRule() {
  const [addRuleToRuleGroup] = useAddRuleToRuleGroup();

  return useAsync(async (deletedRule: RulerGrafanaRuleDTO<GrafanaRuleDefinition>) => {
    const ruleGroupIdentifier = {
      dataSourceName: GRAFANA_RULES_SOURCE_NAME,
      namespaceName: deletedRule.grafana_alert.namespace_uid,
      groupName: deletedRule.grafana_alert.rule_group,
    };
    // save the new rule to the rule group
    return addRuleToRuleGroup.execute(ruleGroupIdentifier, deletedRule);
  });
}
