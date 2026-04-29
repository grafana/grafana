import { useMemo } from 'react';

import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { GrafanaPromRuleDTO, GrafanaPromRuleGroupDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { GRAFANA_RULES_SOURCE_NAME, GrafanaRulesSource } from '../../utils/datasource';
import { groups } from '../../utils/navigation';
import { totalFromStats } from '../../utils/ruleStats';
import { getRulePluginOrigin, prometheusRuleType } from '../../utils/rules';
import { createRelativeUrl } from '../../utils/url';

import {
  AlertRuleListItem,
  RecordingRuleListItem,
  RuleListItemCommonProps,
  UnknownRuleListItem,
} from './AlertRuleListItem';
import { RuleActionsButtons } from './RuleActionsButtons.V2';

interface FolderRuleListItemProps {
  rule: GrafanaPromRuleDTO;
  group: GrafanaPromRuleGroupDTO;
  namespaceName: string;
}

/**
 * Renders a single rule item using pre-fetched data from the group response.
 * This avoids unnecessary API calls since rules are already included when groups are fetched.
 */
export function FolderRuleListItem({ rule, group, namespaceName }: FolderRuleListItemProps) {
  const { name, uid, labels, provenance } = rule;

  const groupIdentifier: GrafanaRuleGroupIdentifier = useMemo(
    () => ({
      groupName: group.name,
      namespace: {
        uid: group.folderUid,
      },
      groupOrigin: 'grafana',
    }),
    [group.name, group.folderUid]
  );

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
        showLocation={false}
      />
    );
  }

  if (prometheusRuleType.grafana.recordingRule(rule)) {
    return <RecordingRuleListItem {...commonProps} showLocation={false} />;
  }

  return <UnknownRuleListItem ruleName={name} groupIdentifier={groupIdentifier} ruleDefinition={rule} />;
}
