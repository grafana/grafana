import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { GrafanaPromRuleDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { GRAFANA_RULES_SOURCE_NAME, GrafanaRulesSource } from '../utils/datasource';
import { groups } from '../utils/navigation';
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

interface GrafanaRuleListItemProps {
  rule: GrafanaPromRuleDTO;
  groupIdentifier: GrafanaRuleGroupIdentifier;
  namespaceName: string;
  operation?: 'creating' | 'deleting';
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

  const groupUrl = groups.detailsPageLink(
    GRAFANA_RULES_SOURCE_NAME,
    groupIdentifier.namespace.uid,
    groupIdentifier.groupName
  );

  const commonProps: RuleListItemCommonProps = {
    name,
    rulesSource: GrafanaRulesSource,
    group: groupIdentifier.groupName,
    groupUrl,
    namespace: namespaceName,
    href: createRelativeUrl(`/alerting/grafana/${uid}/view`),
    health: rule?.health,
    error: rule?.lastError,
    labels: labels,
    isProvisioned: Boolean(provenance),
    isPaused: rule?.isPaused,
    application: 'grafana' as const,
    actions: <RuleActionsButtons promRule={rule} groupIdentifier={groupIdentifier} compact />,
    querySourceUIDs: rule?.queriedDatasourceUIDs,
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
