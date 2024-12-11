import { memo, useMemo } from 'react';

import { DataSourceRuleGroupIdentifier, Rule, RuleIdentifier } from 'app/types/unified-alerting';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { equal, fromRule, fromRulerRule, stringifyIdentifier } from '../utils/rule-id';
import { getRulePluginOrigin, isAlertingRule, isRecordingRule } from '../utils/rules';
import { createRelativeUrl } from '../utils/url';

import { AlertRuleListItem, RecordingRuleListItem, UnknownRuleListItem } from './components/AlertRuleListItem';
import { ActionsLoader, RuleActionsButtons } from './components/RuleActionsButtons.V2';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;
const { useGetRuleGroupForNamespaceQuery } = alertRuleApi;

interface AlertRuleLoaderProps {
  rule: Rule;
  groupIdentifier: DataSourceRuleGroupIdentifier;
}

export const AlertRuleLoader = memo(function AlertRuleLoader({ rule, groupIdentifier }: AlertRuleLoaderProps) {
  const { rulesSource, namespace, groupName } = groupIdentifier;

  const ruleIdentifier = fromRule(rulesSource.name, namespace.name, groupName, rule);
  const href = createViewLinkFromIdentifier(ruleIdentifier);
  const originMeta = getRulePluginOrigin(rule);

  // @TODO work with context API to propagate rulerConfig and such
  const { data: dataSourceInfo } = useDiscoverDsFeaturesQuery({ uid: rulesSource.uid });

  // @TODO refactor this to use a separate hook (useRuleWithLocation() and useCombinedRule() seems to introduce infinite loading / recursion)
  const {
    isLoading,
    data: rulerRuleGroup,
    // error,
  } = useGetRuleGroupForNamespaceQuery(
    {
      namespace: namespace.name,
      group: groupName,
      rulerConfig: dataSourceInfo?.rulerConfig!,
    },
    { skip: !dataSourceInfo?.rulerConfig }
  );

  const rulerRule = useMemo(() => {
    if (!rulerRuleGroup) {
      return;
    }

    return rulerRuleGroup.rules.find((rule) =>
      equal(fromRulerRule(rulesSource.name, namespace.name, groupName, rule), ruleIdentifier)
    );
  }, [rulesSource, namespace, groupName, ruleIdentifier, rulerRuleGroup]);

  // 1. get the rule from the ruler API with "ruleWithLocation"
  // 1.1 skip this if this datasource does not have a ruler
  //
  // 2.1 render action buttons
  // 2.2 render provisioning badge and contact point metadata, etc.
  const actions = useMemo(() => {
    if (isLoading) {
      return <ActionsLoader />;
    }

    if (rulerRule) {
      return <RuleActionsButtons rule={rulerRule} promRule={rule} groupIdentifier={groupIdentifier} compact />;
    }

    return null;
  }, [groupIdentifier, isLoading, rule, rulerRule]);

  if (isAlertingRule(rule)) {
    return (
      <AlertRuleListItem
        name={rule.name}
        rulesSource={rulesSource}
        application={dataSourceInfo?.application}
        group={groupName}
        namespace={namespace.name}
        href={href}
        summary={rule.annotations?.summary}
        state={rule.state}
        health={rule.health}
        error={rule.lastError}
        labels={rule.labels}
        isProvisioned={undefined}
        instancesCount={rule.alerts?.length}
        actions={actions}
        origin={originMeta}
      />
    );
  }

  if (isRecordingRule(rule)) {
    return (
      <RecordingRuleListItem
        name={rule.name}
        rulesSource={rulesSource}
        application={dataSourceInfo?.application}
        group={groupName}
        namespace={namespace.name}
        href={href}
        health={rule.health}
        error={rule.lastError}
        labels={rule.labels}
        isProvisioned={undefined}
        actions={actions}
        origin={originMeta}
      />
    );
  }

  return <UnknownRuleListItem rule={rule} groupIdentifier={groupIdentifier} />;
});

function createViewLinkFromIdentifier(identifier: RuleIdentifier, returnTo?: string) {
  const paramId = encodeURIComponent(stringifyIdentifier(identifier));
  const paramSource = encodeURIComponent(identifier.ruleSourceName);

  return createRelativeUrl(`/alerting/${paramSource}/${paramId}/view`, returnTo ? { returnTo } : {});
}
