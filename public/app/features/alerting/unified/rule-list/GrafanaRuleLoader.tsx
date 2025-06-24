import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { GrafanaRuleGroupIdentifier, GrafanaRuleIdentifier } from 'app/types/unified-alerting';
import { GrafanaPromRuleDTO, PromRuleType, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { prometheusApi } from '../api/prometheusApi';
import { createReturnTo } from '../hooks/useReturnTo';
import { GrafanaRulesSource } from '../utils/datasource';
import { totalFromStats } from '../utils/ruleStats';
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
const { useGetGrafanaGroupsQuery } = prometheusApi;

interface GrafanaRuleLoaderProps {
  ruleIdentifier: GrafanaRuleIdentifier;
  groupIdentifier: GrafanaRuleGroupIdentifier;
  namespaceName: string;
}

export function GrafanaRuleLoader({ ruleIdentifier, groupIdentifier, namespaceName }: GrafanaRuleLoaderProps) {
  const {
    data: rulerRuleGroup,
    error: rulerRuleGroupError,
    isLoading: isRulerRuleGroupLoading,
  } = useGetGrafanaRulerGroupQuery({
    folderUid: groupIdentifier.namespace.uid,
    groupName: groupIdentifier.groupName,
  });
  const {
    data: promRuleGroup,
    error: promRuleGroupError,
    isLoading: isPromRuleGroupLoading,
  } = useGetGrafanaGroupsQuery({
    folderUid: groupIdentifier.namespace.uid,
    groupName: groupIdentifier.groupName,
  });

  const rulerRule = rulerRuleGroup?.rules.find((rulerRule) => rulerRule.grafana_alert.uid === ruleIdentifier.uid);
  const promRule = promRuleGroup?.data.groups
    .flatMap((group) => group.rules)
    .find((promRule) => promRule.uid === ruleIdentifier.uid);

  if (rulerRuleGroupError || promRuleGroupError) {
    return <RulerRuleLoadingError ruleIdentifier={ruleIdentifier} error={rulerRuleGroupError || promRuleGroupError} />;
  }

  if (isRulerRuleGroupLoading || isPromRuleGroupLoading) {
    return <AlertRuleListItemSkeleton />;
  }

  if (!rulerRule) {
    return (
      <Alert
        title={t('alerting.rule-list.cannot-load-rule-details-for', 'Cannot load rule details for UID {{uid}}', {
          uid: ruleIdentifier.uid,
        })}
        severity="error"
      >
        <Trans i18nKey="alerting.rule-list.cannot-find-rule-details-for">
          Cannot find rule details for UID {{ uid: ruleIdentifier.uid ?? '<empty uid>' }}
        </Trans>
      </Alert>
    );
  }

  return (
    <GrafanaRuleListItem
      rule={promRule}
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
  showLocation?: boolean;
}

export function GrafanaRuleListItem({
  rule,
  rulerRule,
  groupIdentifier,
  namespaceName,
  operation,
  showLocation = true,
}: GrafanaRuleListItemProps) {
  const returnTo = createReturnTo();

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
    href: createRelativeUrl(`/alerting/grafana/${uid}/view`, { returnTo }),
    health: rule?.health,
    error: rule?.lastError,
    labels: labels,
    isProvisioned: Boolean(provenance),
    isPaused: rule?.isPaused ?? is_paused,
    application: 'grafana' as const,
    actions: <RuleActionsButtons rule={rulerRule} promRule={rule} groupIdentifier={groupIdentifier} compact />,
    showLocation,
  };

  if (rulerRuleType.grafana.alertingRule(rulerRule)) {
    const promAlertingRule = rule && rule.type === PromRuleType.Alerting ? rule : undefined;
    const instancesCount = totalFromStats(promAlertingRule?.totals ?? {});

    return (
      <AlertRuleListItem
        {...commonProps}
        summary={annotations.summary}
        state={promAlertingRule?.state}
        instancesCount={instancesCount}
        operation={operation}
      />
    );
  }

  if (rulerRuleType.grafana.recordingRule(rulerRule)) {
    return <RecordingRuleListItem {...commonProps} />;
  }

  return <UnknownRuleListItem ruleName={title} groupIdentifier={groupIdentifier} ruleDefinition={rulerRule} />;
}
