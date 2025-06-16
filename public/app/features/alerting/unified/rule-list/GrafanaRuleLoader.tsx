import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { GrafanaRuleGroupIdentifier, GrafanaRuleIdentifier } from 'app/types/unified-alerting';
import { GrafanaPromRuleDTO, PromRuleType } from 'app/types/unified-alerting-dto';

import { prometheusApi } from '../api/prometheusApi';
import { createReturnTo } from '../hooks/useReturnTo';
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
import { AlertRuleListItemSkeleton, RulerRuleLoadingError } from './components/AlertRuleListItemLoader';
import { RuleActionsButtons } from './components/RuleActionsButtons.V2';
import { RuleOperation } from './components/RuleListIcon';

// const { useGetGrafanaRulerGroupQuery } = alertRuleApi;
const { useGetGrafanaGroupsQuery } = prometheusApi;

interface GrafanaRuleLoaderProps {
  ruleIdentifier: GrafanaRuleIdentifier;
  groupIdentifier: GrafanaRuleGroupIdentifier;
  namespaceName: string;
}

export function GrafanaRuleLoader({ ruleIdentifier, groupIdentifier, namespaceName }: GrafanaRuleLoaderProps) {
  // const {
  //   data: rulerRuleGroup,
  //   error: rulerRuleGroupError,
  //   isLoading: isRulerRuleGroupLoading,
  // } = useGetGrafanaRulerGroupQuery({
  //   folderUid: groupIdentifier.namespace.uid,
  //   groupName: groupIdentifier.groupName,
  // });
  const {
    data: promRuleGroup,
    error: promRuleGroupError,
    isLoading: isPromRuleGroupLoading,
  } = useGetGrafanaGroupsQuery({
    folderUid: groupIdentifier.namespace.uid,
    groupName: groupIdentifier.groupName,
  });

  // const rulerRule = rulerRuleGroup?.rules.find((rulerRule) => rulerRule.grafana_alert.uid === ruleIdentifier.uid);
  const promRule = promRuleGroup?.data.groups
    .flatMap((group) => group.rules)
    .find((promRule) => promRule.uid === ruleIdentifier.uid);

  if (promRuleGroupError) {
    return <RulerRuleLoadingError ruleIdentifier={ruleIdentifier} error={promRuleGroupError} />;
  }

  if (isPromRuleGroupLoading) {
    return <AlertRuleListItemSkeleton />;
  }

  // if (!rulerRule) {
  //   return (
  //     <Alert
  //       title={t('alerting.rule-list.cannot-load-rule-details-for', 'Cannot load rule details for UID {{uid}}', {
  //         uid: ruleIdentifier.uid,
  //       })}
  //       severity="error"
  //     >
  //       <Trans i18nKey="alerting.rule-list.cannot-find-rule-details-for">
  //         Cannot find rule details for UID {{ uid: ruleIdentifier.uid ?? '<empty uid>' }}
  //       </Trans>
  //     </Alert>
  //   );
  // }

  if (!promRule) {
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
      // rulerRule={rulerRule}
      groupIdentifier={groupIdentifier}
      namespaceName={namespaceName}
    />
  );
}

interface GrafanaRuleListItemProps {
  rule: GrafanaPromRuleDTO;
  // rulerRule: RulerGrafanaRuleDTO;
  groupIdentifier: GrafanaRuleGroupIdentifier;
  namespaceName: string;
  operation?: RuleOperation;
  showLocation?: boolean;
}

export function GrafanaRuleListItem({
  rule,
  // rulerRule,
  groupIdentifier,
  namespaceName,
  operation,
  showLocation = true,
}: GrafanaRuleListItemProps) {
  const returnTo = createReturnTo();
  const { name, uid, labels, provenance } = rule;

  const commonProps: RuleListItemCommonProps = {
    name,
    rulesSource: GrafanaRulesSource,
    group: groupIdentifier.groupName,
    namespace: namespaceName,
    href: createRelativeUrl(`/alerting/grafana/${uid}/view`, { returnTo }),
    health: rule?.health,
    error: rule?.lastError,
    labels: labels,
    isProvisioned: Boolean(provenance),
    isPaused: rule?.isPaused,
    application: 'grafana' as const,
    actions: <RuleActionsButtons promRule={rule} groupIdentifier={groupIdentifier} compact />,
    showLocation,
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
      />
    );
  }

  if (prometheusRuleType.grafana.recordingRule(rule)) {
    return <RecordingRuleListItem {...commonProps} />;
  }

  return <UnknownRuleListItem ruleName={name} groupIdentifier={groupIdentifier} ruleDefinition={rule} />;
}
