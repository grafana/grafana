import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { GrafanaPromRuleDTO, PromRuleType, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { GrafanaRulesSource } from '../utils/datasource';
import { createRelativeUrl } from '../utils/url';

import { AlertRuleListItem, RecordingRuleListItem, UnknownRuleListItem } from './components/AlertRuleListItem';
import { AlertRuleListItemLoader, RulerRuleLoadingError } from './components/AlertRuleListItemLoader';
import { RuleActionsButtons } from './components/RuleActionsButtons.V2';

const { useGetGrafanaRulerGroupQuery } = alertRuleApi;

interface GrafanaRuleLoaderProps {
  rule: GrafanaPromRuleDTO;

  groupIdentifier: GrafanaRuleGroupIdentifier;
  // TODO: How to improve this?
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
  rule: GrafanaPromRuleDTO;
  rulerRule: RulerGrafanaRuleDTO;
  groupIdentifier: GrafanaRuleGroupIdentifier;
  namespaceName: string;
}

export function GrafanaRuleListItem({ rule, rulerRule, groupIdentifier, namespaceName }: GrafanaRuleListItemProps) {
  const {
    grafana_alert: { title, provenance },
    annotations = {},
    labels = {},
  } = rulerRule;

  const isProvisioned = Boolean(provenance);
  const detailsLink = createRelativeUrl(`/alerting/grafana/${rule.uid}/view`);

  switch (rule.type) {
    case PromRuleType.Alerting:
      return (
        <AlertRuleListItem
          name={title}
          rulesSource={GrafanaRulesSource}
          application="grafana"
          group={groupIdentifier.groupName}
          namespace={namespaceName}
          href={detailsLink}
          summary={annotations.summary}
          state={rule.state}
          health={rule.health}
          error={rule.lastError}
          labels={labels}
          isPaused={rulerRule.grafana_alert.is_paused}
          isProvisioned={isProvisioned}
          instancesCount={rule.alerts?.length}
          actions={<RuleActionsButtons rule={rulerRule} promRule={rule} groupIdentifier={groupIdentifier} compact />}
        />
      );
    case PromRuleType.Recording:
      return (
        <RecordingRuleListItem
          name={rule.name}
          rulesSource={GrafanaRulesSource}
          application="grafana"
          group={groupIdentifier.groupName}
          namespace={namespaceName}
          href={detailsLink}
          health={rule.health}
          error={rule.lastError}
          labels={rule.labels}
          isPaused={rulerRule.grafana_alert.is_paused}
          isProvisioned={isProvisioned}
          actions={<RuleActionsButtons rule={rulerRule} promRule={rule} groupIdentifier={groupIdentifier} compact />}
        />
      );
    default:
      return <UnknownRuleListItem rule={rule} groupIdentifier={groupIdentifier} />;
  }
}
