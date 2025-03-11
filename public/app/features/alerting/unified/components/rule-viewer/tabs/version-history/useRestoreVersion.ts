import { useUpdateRuleInRuleGroup } from 'app/features/alerting/unified/hooks/ruleGroup/useUpsertRuleFromRuleGroup';
import { useAsync } from 'app/features/alerting/unified/hooks/useAsync';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { fromRulerRuleAndRuleGroupIdentifier } from 'app/features/alerting/unified/utils/rule-id';
import { getRuleGroupLocationFromRuleWithLocation } from 'app/features/alerting/unified/utils/rules';
import { RuleWithLocation } from 'app/types/unified-alerting';
import { GrafanaRuleDefinition, RulerGrafanaRuleDTO, RulerRuleDTO } from 'app/types/unified-alerting-dto';

export function useRestoreVersion() {
  const [updateRuleInRuleGroup] = useUpdateRuleInRuleGroup();

  return useAsync(
    async (
      newVersion: RulerGrafanaRuleDTO<GrafanaRuleDefinition>,
      ruleWithLocation: RuleWithLocation<RulerRuleDTO>
    ) => {
      const ruleGroupIdentifier = getRuleGroupLocationFromRuleWithLocation(ruleWithLocation);
      const ruleIdentifier = fromRulerRuleAndRuleGroupIdentifier(ruleGroupIdentifier, newVersion);
      // restore version
      return updateRuleInRuleGroup.execute(ruleGroupIdentifier, ruleIdentifier, newVersion, {
        dataSourceName: GRAFANA_RULES_SOURCE_NAME,
        namespaceName: newVersion.grafana_alert.namespace_uid,
        groupName: newVersion.grafana_alert.rule_group,
      });
    }
  );
}
