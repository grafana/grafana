import { memo, useMemo } from 'react';

import { DataSourceRuleGroupIdentifier, Rule } from 'app/types/unified-alerting';
import { RulerCloudRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { featureDiscoveryApi } from '../api/featureDiscoveryApi';
import { getPromRuleFingerprint, getRulerRuleFingerprint } from '../utils/rule-id';
import { getRuleName, isCloudRulerGroup } from '../utils/rules';

import { DataSourceRuleListItem } from './DataSourceRuleListItem';
import { RuleActionsButtons } from './components/RuleActionsButtons.V2';
import { RuleActionsSkeleton } from './components/RuleActionsSkeleton';

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;
const { useGetRuleGroupForNamespaceQuery } = alertRuleApi;

interface DataSourceRuleLoaderProps {
  rule: Rule;
  groupIdentifier: DataSourceRuleGroupIdentifier;
}

export const DataSourceRuleLoader = memo(function DataSourceRuleLoader({
  rule,
  groupIdentifier,
}: DataSourceRuleLoaderProps) {
  const { rulesSource, namespace, groupName } = groupIdentifier;

  // @TODO work with context API to propagate rulerConfig and such
  const { data: dataSourceInfo } = useDiscoverDsFeaturesQuery({ uid: rulesSource.uid });

  // @TODO refactor this to use a separate hook (useRuleWithLocation() and useCombinedRule() seems to introduce infinite loading / recursion)
  const { isLoading, data: rulerRuleGroup } = useGetRuleGroupForNamespaceQuery(
    { namespace: namespace.name, group: groupName, rulerConfig: dataSourceInfo?.rulerConfig! },
    { skip: !dataSourceInfo?.rulerConfig }
  );

  const rulerRule = useMemo(() => {
    if (!rulerRuleGroup) {
      return;
    }

    if (!isCloudRulerGroup(rulerRuleGroup)) {
      return;
    }

    return getMatchingRulerRule(rulerRuleGroup, rule);
  }, [rulerRuleGroup, rule]);

  // 1. get the rule from the ruler API with "ruleWithLocation"
  // 1.1 skip this if this datasource does not have a ruler
  //
  // 2.1 render action buttons
  // 2.2 render provisioning badge and contact point metadata, etc.
  const actions = useMemo(() => {
    if (isLoading) {
      return <RuleActionsSkeleton />;
    }

    if (rulerRule) {
      return <RuleActionsButtons rule={rulerRule} promRule={rule} groupIdentifier={groupIdentifier} compact />;
    }

    return null;
  }, [groupIdentifier, isLoading, rule, rulerRule]);

  return (
    <DataSourceRuleListItem
      rule={rule}
      rulerRule={rulerRule}
      groupIdentifier={groupIdentifier}
      application={dataSourceInfo?.application}
      actions={actions}
    />
  );
});

function getMatchingRulerRule(rulerRuleGroup: RulerRuleGroupDTO<RulerCloudRuleDTO>, rule: Rule) {
  // If all rule names are unique, we can use the rule name to find the rule. We don't need to hash the rule
  const rulesByName = rulerRuleGroup.rules.filter((r) => getRuleName(r) === rule.name);
  if (rulesByName.length === 1) {
    return rulesByName[0];
  }

  // If we don't have a unique rule name, try to compare by labels and annotations
  const rulesByLabelsAndAnnotations = rulesByName.filter((r) => {
    return getRulerRuleFingerprint(r, false).join('-') === getPromRuleFingerprint(rule, false).join('-');
  });

  if (rulesByLabelsAndAnnotations.length === 1) {
    return rulesByLabelsAndAnnotations[0];
  }

  // As a last resort, compare including the query
  const rulesByLabelsAndAnnotationsAndQuery = rulesByName.filter((r) => {
    return getRulerRuleFingerprint(r, true).join('-') === getPromRuleFingerprint(rule, true).join('-');
  });

  if (rulesByLabelsAndAnnotationsAndQuery.length === 1) {
    return rulesByLabelsAndAnnotationsAndQuery[0];
  }

  return undefined;
}
