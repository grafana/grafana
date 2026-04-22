import { ExpressionDatasourceUID } from 'app/features/expressions/types';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { useExternalGlobalRuleAbility, useGlobalRuleAbility } from '../../../hooks/abilities/rules/ruleAbilities';
import { ExternalRuleAction, RuleAction } from '../../../hooks/abilities/types';
import { useHasRulerV2 } from '../../../hooks/useHasRuler';
import { RuleFormType } from '../../../types/rule-form';

export const onlyOneDSInQueries = (queries: AlertQuery[]) => {
  return queries.filter((q) => q.datasourceUid !== ExpressionDatasourceUID).length === 1;
};

export const useGetCanSwitch = ({
  queries,
  ruleFormType,
}: {
  queries: AlertQuery[];
  ruleFormType: RuleFormType | undefined;
}) => {
  const { granted: canCreateGrafanaRules } = useGlobalRuleAbility(RuleAction.Create);
  const { granted: canCreateCloudRules } = useExternalGlobalRuleAbility(ExternalRuleAction.CreateAlertRule);

  const enabledRuleTypes: RuleFormType[] = [];
  if (canCreateGrafanaRules) {
    enabledRuleTypes.push(RuleFormType.grafana);
  }
  if (canCreateCloudRules) {
    enabledRuleTypes.push(RuleFormType.cloudAlerting, RuleFormType.cloudRecording);
  }

  // check if we have only one query in queries and if it's a cloud datasource
  const onlyOneDS = onlyOneDSInQueries(queries);
  const isRecordingRuleType = ruleFormType === RuleFormType.cloudRecording;
  const dataSourceIdFromQueries = queries[0]?.datasourceUid ?? '';
  const { hasRuler } = useHasRulerV2(dataSourceIdFromQueries);

  //let's check if we switch to cloud type
  const canSwitchToCloudRule = !isRecordingRuleType && onlyOneDS && hasRuler;

  const canSwitchToGrafanaRule = !isRecordingRuleType;
  // check for enabled types
  const grafanaTypeEnabled = enabledRuleTypes.includes(RuleFormType.grafana);
  const cloudTypeEnabled = enabledRuleTypes.includes(RuleFormType.cloudAlerting);

  // can we switch to the other type? (cloud or grafana)
  const canSwitchFromCloudToGrafana =
    ruleFormType === RuleFormType.cloudAlerting && grafanaTypeEnabled && canSwitchToGrafanaRule;
  const canSwitchFromGrafanaToCloud =
    ruleFormType === RuleFormType.grafana && canSwitchToCloudRule && cloudTypeEnabled && canSwitchToCloudRule;

  return canSwitchFromCloudToGrafana || canSwitchFromGrafanaToCloud;
};
