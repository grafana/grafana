import { type GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { type GrafanaPromRuleDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { Annotation } from '../utils/constants';
import { GRAFANA_RULES_SOURCE_NAME, GrafanaRulesSource } from '../utils/datasource';
import { groups } from '../utils/navigation';
import { totalFromStats } from '../utils/ruleStats';
import { getRulePluginOrigin, prometheusRuleType } from '../utils/rules';
import { createRelativeUrl } from '../utils/url';

import {
  AlertRuleListItem,
  RecordingRuleListItem,
  type RuleListItemCommonProps,
  UnknownRuleListItem,
} from './components/AlertRuleListItem';
import { RuleActionsButtons } from './components/RuleActionsButtons.V2';

interface GrafanaRuleListItemProps {
  rule: GrafanaPromRuleDTO;
  groupIdentifier: GrafanaRuleGroupIdentifier;
  namespaceName: string;
  operation?: 'creating' | 'deleting';
  showLocation?: boolean;
  evalIntervalSeconds?: number;
}

export function GrafanaRuleListItem({
  rule,
  groupIdentifier,
  namespaceName,
  operation,
  showLocation = true,
  evalIntervalSeconds,
}: GrafanaRuleListItemProps) {
  const { currentData: alertingConfig } = alertmanagerApi.endpoints.getGrafanaAlertingConfiguration.useQuery();
  const requireDescriptions = alertingConfig?.reject_alerts_without_descriptions ?? false;
  const requireRunbookURL = alertingConfig?.reject_alerts_without_runbook_url ?? false;

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
    origin: getRulePluginOrigin(rule),
    evalIntervalSeconds,
  };

  if (prometheusRuleType.grafana.alertingRule(rule)) {
    const promAlertingRule = rule && rule.type === PromRuleType.Alerting ? rule : undefined;
    const instancesCount = totalFromStats(promAlertingRule?.totals ?? {});

    const annotations = rule.annotations ?? {};
    const isMissingRequiredAnnotations =
      (requireDescriptions &&
        (!annotations[Annotation.summary]?.trim() || !annotations[Annotation.description]?.trim())) ||
      (requireRunbookURL && !annotations[Annotation.runbookURL]?.trim());

    return (
      <AlertRuleListItem
        {...commonProps}
        summary={annotations[Annotation.summary]}
        state={promAlertingRule?.state}
        instancesCount={instancesCount}
        operation={operation}
        showLocation={showLocation}
        isMissingRequiredAnnotations={isMissingRequiredAnnotations}
      />
    );
  }

  if (prometheusRuleType.grafana.recordingRule(rule)) {
    return <RecordingRuleListItem {...commonProps} showLocation={showLocation} />;
  }

  return <UnknownRuleListItem ruleName={name} groupIdentifier={groupIdentifier} ruleDefinition={rule} />;
}
