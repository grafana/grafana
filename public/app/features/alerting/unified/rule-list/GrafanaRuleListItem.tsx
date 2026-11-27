import { isEqual, omit } from 'lodash';
import { memo, useMemo } from 'react';
import { shallowEqual } from 'react-redux';

import { type GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { type GrafanaPromRuleDTO, PromRuleType } from 'app/types/unified-alerting-dto';

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

// The row doesn't show these, and every rule gets new values each time its group evaluates.
// Remove one here if the row ever starts showing it, or its updates will be skipped.
const IGNORED_RULE_FIELDS = ['lastEvaluation', 'evaluationTime'] as const;

function arePropsEqual(prev: GrafanaRuleListItemProps, next: GrafanaRuleListItemProps) {
  const { rule: prevRule, ...prevOtherProps } = prev;
  const { rule: nextRule, ...nextOtherProps } = next;

  return (
    shallowEqual(prevOtherProps, nextOtherProps) &&
    (prevRule === nextRule || isEqual(omit(prevRule, IGNORED_RULE_FIELDS), omit(nextRule, IGNORED_RULE_FIELDS)))
  );
}

export const GrafanaRuleListItem = memo(GrafanaRuleListItemImpl, arePropsEqual);

function GrafanaRuleListItemImpl({
  rule,
  groupIdentifier,
  namespaceName,
  operation,
  showLocation = true,
  evalIntervalSeconds,
}: GrafanaRuleListItemProps) {
  const { name, uid, labels, provenance } = rule;

  const groupUrl = groups.detailsPageLink(
    GRAFANA_RULES_SOURCE_NAME,
    groupIdentifier.namespace.uid,
    groupIdentifier.groupName
  );

  // memo can't skip this row when a prop other than rule/groupIdentifier changes (e.g. namespaceName);
  // a stable element keeps the actions from re-rendering then
  const actions = useMemo(
    () => <RuleActionsButtons promRule={rule} groupIdentifier={groupIdentifier} compact />,
    [rule, groupIdentifier]
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
    provenance,
    isPaused: rule?.isPaused,
    application: 'grafana' as const,
    actions,
    querySourceUIDs: rule?.queriedDatasourceUIDs,
    origin: getRulePluginOrigin(rule),
    evalIntervalSeconds,
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
