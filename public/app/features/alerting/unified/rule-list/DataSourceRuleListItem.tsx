import { DataSourceRuleGroupIdentifier, Rule, RuleIdentifier } from 'app/types/unified-alerting';
import { RulerRuleDTO, RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { Annotation } from '../utils/constants';
import { fromRule, fromRulerRule, stringifyIdentifier } from '../utils/rule-id';
import { getRuleName, getRulePluginOrigin, isAlertingRule, isAlertingRulerRule, isRecordingRule } from '../utils/rules';
import { createRelativeUrl } from '../utils/url';

import { AlertRuleListItem, RecordingRuleListItem, UnknownRuleListItem } from './components/AlertRuleListItem';

export interface DataSourceRuleListItemProps {
  rule: Rule;
  rulerRule?: RulerRuleDTO;
  groupIdentifier: DataSourceRuleGroupIdentifier;
  application?: RulesSourceApplication;
  actions?: React.ReactNode;
}

export function DataSourceRuleListItem({
  rule,
  rulerRule,
  groupIdentifier,
  application,
  actions,
}: DataSourceRuleListItemProps) {
  const { rulesSource, namespace, groupName } = groupIdentifier;

  const ruleIdentifier = rulerRule
    ? fromRulerRule(rulesSource.name, namespace.name, groupName, rulerRule)
    : fromRule(rulesSource.name, namespace.name, groupName, rule);
  const href = createViewLinkFromIdentifier(ruleIdentifier);
  const originMeta = getRulePluginOrigin(rule);

  // If ruler ruler is available, we should use it as it contains fresh data
  const ruleName = rulerRule ? getRuleName(rulerRule) : rule.name;
  const labels = rulerRule ? rulerRule.labels : rule.labels;

  if (isAlertingRule(rule)) {
    const annotations = (isAlertingRulerRule(rulerRule) ? rulerRule.annotations : rule.annotations) ?? {};
    const summary = annotations[Annotation.summary];

    return (
      <AlertRuleListItem
        name={ruleName}
        rulesSource={rulesSource}
        application={application}
        group={groupName}
        namespace={namespace.name}
        href={href}
        summary={summary}
        state={rule.state}
        health={rule.health}
        error={rule.lastError}
        labels={labels}
        instancesCount={rule.alerts?.length}
        actions={actions}
        origin={originMeta}
      />
    );
  }

  if (isRecordingRule(rule)) {
    return (
      <RecordingRuleListItem
        name={ruleName}
        rulesSource={rulesSource}
        application={application}
        group={groupName}
        namespace={namespace.name}
        href={href}
        health={rule.health}
        error={rule.lastError}
        labels={labels}
        actions={actions}
        origin={originMeta}
      />
    );
  }

  return <UnknownRuleListItem rule={rule} groupIdentifier={groupIdentifier} />;
}

export function createViewLinkFromIdentifier(identifier: RuleIdentifier, returnTo?: string) {
  const paramId = encodeURIComponent(stringifyIdentifier(identifier));
  const paramSource = encodeURIComponent(identifier.ruleSourceName);

  return createRelativeUrl(`/alerting/${paramSource}/${paramId}/view`, returnTo ? { returnTo } : {});
}
