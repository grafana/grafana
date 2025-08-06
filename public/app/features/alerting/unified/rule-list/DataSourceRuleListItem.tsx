import React from 'react';

import { DataSourceRuleGroupIdentifier, Rule, RuleIdentifier } from 'app/types/unified-alerting';
import { PromRuleType, RulerRuleDTO, RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { createReturnTo } from '../hooks/useReturnTo';
import { Annotation } from '../utils/constants';
import { groups } from '../utils/navigation';
import { fromRule, fromRulerRule, stringifyIdentifier } from '../utils/rule-id';
import { getRuleName, getRulePluginOrigin, rulerRuleType } from '../utils/rules';
import { createRelativeUrl } from '../utils/url';

import {
  AlertRuleListItem,
  RecordingRuleListItem,
  RuleListItemCommonProps,
  UnknownRuleListItem,
} from './components/AlertRuleListItem';

export interface DataSourceRuleListItemProps {
  rule: Rule;
  rulerRule?: RulerRuleDTO;
  groupIdentifier: DataSourceRuleGroupIdentifier;
  application?: RulesSourceApplication;
  actions?: React.ReactNode;
  showLocation?: boolean;
}

export function DataSourceRuleListItem({
  rule,
  rulerRule,
  groupIdentifier,
  application,
  actions,
  showLocation = true,
}: DataSourceRuleListItemProps) {
  const returnTo = createReturnTo();
  const { rulesSource, namespace, groupName } = groupIdentifier;

  const ruleIdentifier = rulerRule
    ? fromRulerRule(rulesSource.name, namespace.name, groupName, rulerRule)
    : fromRule(rulesSource.name, namespace.name, groupName, rule);
  const href = createViewLinkFromIdentifier(ruleIdentifier, returnTo);
  const originMeta = getRulePluginOrigin(rule);

  // If ruler rule is available, we should use it as it contains fresh data
  const ruleName = rulerRule ? getRuleName(rulerRule) : rule.name;
  const labels = rulerRule ? rulerRule.labels : rule.labels;

  const groupUrl = groups.detailsPageLink(rulesSource.uid, namespace.name, groupName);

  const commonProps: RuleListItemCommonProps = {
    name: ruleName,
    rulesSource: rulesSource,
    application: application,
    group: groupName,
    groupUrl,
    namespace: namespace.name,
    href,
    health: rule.health,
    error: rule.lastError,
    labels,
    actions,
    origin: originMeta,
    showLocation,
  };

  switch (rule.type) {
    case PromRuleType.Alerting:
      const annotations = (rulerRuleType.any.alertingRule(rulerRule) ? rulerRule.annotations : rule.annotations) ?? {};
      const summary = annotations[Annotation.summary];

      return (
        <AlertRuleListItem {...commonProps} summary={summary} state={rule.state} instancesCount={rule.alerts?.length} />
      );
    case PromRuleType.Recording:
      return <RecordingRuleListItem {...commonProps} />;
    default:
      return <UnknownRuleListItem ruleName={ruleName} groupIdentifier={groupIdentifier} ruleDefinition={rule} />;
  }
}

export function createViewLinkFromIdentifier(identifier: RuleIdentifier, returnTo?: string) {
  const paramId = encodeURIComponent(stringifyIdentifier(identifier));
  const paramSource = encodeURIComponent(identifier.ruleSourceName);

  return createRelativeUrl(`/alerting/${paramSource}/${paramId}/view`, returnTo ? { returnTo } : {});
}
