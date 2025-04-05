import { Alert } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { GrafanaPromRuleDTO, PromRuleType, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { GrafanaRulesSource } from '../utils/datasource';
import { rulerRuleType } from '../utils/rules';
import { createRelativeUrl } from '../utils/url';

import {
  AlertRuleListItem,
  RecordingRuleListItem,
  RuleListItemCommonProps,
  UnknownRuleListItem,
} from './components/AlertRuleListItem';
import { AlertRuleListItemSkeleton, RulerRuleLoadingError } from './components/AlertRuleListItemLoader';
import { RuleActionsButtons } from './components/RuleActionsButtons.V2';
import { RuleOperation } from './components/RuleListIcon';

const { useGetGrafanaRulerGroupQuery } = alertRuleApi;

interface GrafanaRuleLoaderProps {
  rule: GrafanaPromRuleDTO;

  groupIdentifier: GrafanaRuleGroupIdentifier;
  namespaceName: string;
}

export function GrafanaRuleLoader({ rule, groupIdentifier, namespaceName }: GrafanaRuleLoaderProps) {
  const {
    data: rulerRuleGroup,
    isError,
    isLoading,
  } = useGetGrafanaRulerGroupQuery({
    folderUid: groupIdentifier.namespace.uid,
    groupName: groupIdentifier.groupName,
  });

  const rulerRule = rulerRuleGroup?.rules.find((rulerRule) => rulerRule.grafana_alert.uid === rule.uid);

  if (isError) {
    return <RulerRuleLoadingError rule={rule} />;
  }

  if (isLoading) {
    return <AlertRuleListItemSkeleton />;
  }

  if (!rulerRule) {
    return (
      <Alert
        title={t('alerting.rule-list.cannot-load-rule-details-for', 'Cannot load rule details for {{name}}', {
          name: rule.name,
        })}
        severity="error"
      >
        <Trans i18nKey="alerting.rule-list.cannot-find-rule-details-for">
          Cannot find rule details for {{ uid: rule.uid ?? '<empty uid>' }}
        </Trans>
      </Alert>
    );
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

  const commonProps: RuleListItemCommonProps = {
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

  if (rulerRuleType.grafana.alertingRule(rulerRule)) {
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

  if (rulerRuleType.grafana.recordingRule(rulerRule)) {
    return <RecordingRuleListItem {...commonProps} />;
  }

  return <UnknownRuleListItem ruleName={title} groupIdentifier={groupIdentifier} ruleDefinition={rulerRule} />;
}
