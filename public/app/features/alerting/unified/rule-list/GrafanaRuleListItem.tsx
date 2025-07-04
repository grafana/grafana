import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { GrafanaPromRuleDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { GrafanaRulesSource } from '../utils/datasource';
import { totalFromStats } from '../utils/ruleStats';
import { prometheusRuleType } from '../utils/rules';
import { createRelativeUrl } from '../utils/url';

import {
  AlertRuleListItem,
  RecordingRuleListItem,
  RuleListItemCommonProps,
  UnknownRuleListItem,
} from './components/AlertRuleListItem';
import { RuleActionsButtons } from './components/RuleActionsButtons.V2';
import { RuleOperation } from './components/RuleListIcon';

interface GrafanaRuleListItemProps {
  rule: GrafanaPromRuleDTO;
  groupIdentifier: GrafanaRuleGroupIdentifier;
  namespaceName: string;
  operation?: RuleOperation;
  showLocation?: boolean;
}

export function GrafanaRuleListItem({
  rule,
  groupIdentifier,
  namespaceName,
  operation,
  showLocation = true,
}: GrafanaRuleListItemProps) {
  const { name, uid, labels, provenance } = rule;

  const commonProps: RuleListItemCommonProps = {
    name,
    rulesSource: GrafanaRulesSource,
    group: groupIdentifier.groupName,
    namespace: namespaceName,
    href: createRelativeUrl(`/alerting/grafana/${uid}/view`),
    health: rule?.health,
    error: rule?.lastError,
    labels: labels,
    isProvisioned: Boolean(provenance),
    isPaused: rule?.isPaused,
    application: 'grafana' as const,
    actions: <RuleActionsButtons promRule={rule} groupIdentifier={groupIdentifier} compact />,
  };

  if (prometheusRuleType.grafana.alertingRule(rule)) {
    const promAlertingRule = rule && rule.type === PromRuleType.Alerting ? rule : undefined;
    const instancesCount = totalFromStats(promAlertingRule?.totals ?? {});

    return (
      <AlertRuleListItem
        {...commonProps}
        summary={rule.annotations?.summary}
        state={promAlertingRule?.state}
        instancesCount={instancesCount}
        operation={operation}
        showLocation={showLocation}
      />
    );
  }

  if (prometheusRuleType.grafana.recordingRule(rule)) {
    return <RecordingRuleListItem {...commonProps} showLocation={showLocation} />;
  }

  return <UnknownRuleListItem ruleName={name} groupIdentifier={groupIdentifier} ruleDefinition={rule} />;
}
