import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { GrafanaPromRuleDTO, PromRuleType, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { GrafanaRulesSource } from '../utils/datasource';
import { isGrafanaAlertingRule, isGrafanaRecordingRule } from '../utils/rules';
import { createRelativeUrl } from '../utils/url';

import { AlertRuleListItem, RecordingRuleListItem, UnknownRuleListItem } from './components/AlertRuleListItem';
import { AlertRuleListItemLoader, RulerRuleLoadingError } from './components/AlertRuleListItemLoader';
import { RuleActionsButtons } from './components/RuleActionsButtons.V2';
import { RuleOperation } from './components/RuleListIcon';

const { useGetGrafanaRulerGroupQuery } = alertRuleApi;

interface GrafanaRuleLoaderProps {
  rule: GrafanaPromRuleDTO;

  groupIdentifier: GrafanaRuleGroupIdentifier;
  namespaceName: string;
}

export function GrafanaRuleLoader({ rule, groupIdentifier, namespaceName }: GrafanaRuleLoaderProps) {
  const { data: rulerRuleGroup, isError } = useGetGrafanaRulerGroupQuery({
    folderUid: groupIdentifier.namespace.uid,
    groupName: groupIdentifier.groupName,
  });

  const rulerRule = rulerRuleGroup?.rules.find((rulerRule) => rulerRule.grafana_alert.uid === rule.uid);

  if (!rulerRule) {
    if (isError) {
      return <RulerRuleLoadingError rule={rule} />;
    }

    return <AlertRuleListItemLoader />;
  }

  return (
    <GrafanaRuleListItem
      rule={rule}
      rulerRule={rulerRule}
      groupIdentifier={groupIdentifier}
      namespaceName={namespaceName}
    />
  );
}

interface GrafanaRuleListItemProps {
  rule?: GrafanaPromRuleDTO;
  rulerRule: RulerGrafanaRuleDTO;
  groupIdentifier: GrafanaRuleGroupIdentifier;
  namespaceName: string;
  operation?: RuleOperation;
}

export function GrafanaRuleListItem({
  rule,
  rulerRule,
  groupIdentifier,
  namespaceName,
  operation,
}: GrafanaRuleListItemProps) {
  const {
    grafana_alert: { uid, title, provenance, is_paused },
    annotations = {},
    labels = {},
  } = rulerRule;

  const commonProps = {
    name: title,
    rulesSource: GrafanaRulesSource,
    group: groupIdentifier.groupName,
    namespace: namespaceName,
    href: createRelativeUrl(`/alerting/grafana/${uid}/view`),
    health: rule?.health,
    error: rule?.lastError,
    labels: labels,
    isProvisioned: Boolean(provenance),
    isPaused: is_paused,
    application: 'grafana' as const,
    actions: <RuleActionsButtons rule={rulerRule} promRule={rule} groupIdentifier={groupIdentifier} compact />,
  };

  if (isGrafanaAlertingRule(rulerRule)) {
    const promAlertingRule = rule && rule.type === PromRuleType.Alerting ? rule : undefined;

    return (
      <AlertRuleListItem
        {...commonProps}
        summary={annotations.summary}
        state={promAlertingRule?.state}
        instancesCount={promAlertingRule?.alerts?.length}
        operation={operation}
      />
    );
  }

  if (isGrafanaRecordingRule(rulerRule)) {
    return <RecordingRuleListItem {...commonProps} />;
  }

  return <UnknownRuleListItem ruleName={title} groupIdentifier={groupIdentifier} ruleDefinition={rulerRule} />;
}
