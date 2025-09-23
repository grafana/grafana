import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { GrafanaPromRuleDTO, PromRuleType } from 'app/types/unified-alerting-dto';

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
  namespaceName: string;
}

export function GrafanaRuleLoader({ rule, groupIdentifier, namespaceName }: GrafanaRuleLoaderProps) {
  const { data: rulerRuleGroup, isError } = useGetGrafanaRulerGroupQuery(groupIdentifier);

  const rulerRule = rulerRuleGroup?.rules.find((rulerRule) => rulerRule.grafana_alert.uid === rule.uid);

  if (!rulerRule) {
    if (isError) {
      return <RulerRuleLoadingError rule={rule} />;
    }

    return <AlertRuleListItemLoader />;
  }

  const {
    grafana_alert: { title, provenance, is_paused },
    annotations = {},
    labels = {},
  } = rulerRule;

  const commonProps = {
    name: title,
    rulesSource: GrafanaRulesSource,
    group: groupIdentifier.groupName,
    namespace: namespaceName,
    href: createRelativeUrl(`/alerting/grafana/${rule.uid}/view`),
    health: rule.health,
    error: rule.lastError,
    labels: labels,
    isProvisioned: Boolean(provenance),
    isPaused: is_paused,
    application: 'grafana' as const,
    actions: <RuleActionsButtons rule={rulerRule} promRule={rule} groupIdentifier={groupIdentifier} compact />,
  };

  if (rule.type === PromRuleType.Alerting) {
    return (
      <AlertRuleListItem
        {...commonProps}
        summary={annotations.summary}
        state={rule.state}
        instancesCount={rule.alerts?.length}
      />
    );
  }

  if (rule.type === PromRuleType.Recording) {
    return <RecordingRuleListItem {...commonProps} />;
  }

  return <UnknownRuleListItem rule={rule} groupIdentifier={groupIdentifier} />;
}
