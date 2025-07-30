import { Action } from '@reduxjs/toolkit';

import { GrafanaRulesSourceSymbol, RuleGroupIdentifier } from 'app/types/unified-alerting';
import { PostableRulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { notFoundToNullOrThrow } from '../../api/util';
import { addRuleAction, ruleGroupReducer } from '../../reducers/ruler/ruleGroups';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../../rule-editor/formDefaults';
import { getDatasourceAPIUid } from '../../utils/datasource';

const PREFER_CACHE_VALUE = true;

const { useLazyGetRuleGroupForNamespaceQuery } = alertRuleApi;
const { useLazyDiscoverDsFeaturesQuery } = featureDiscoveryApi;

export const RulerNotSupportedError = (name: string) =>
  new Error(`DataSource ${name} does not support ruler API or does not have the ruler API enabled.`);

/**
 * Hook for reuse that handles freshly fetching a rule group's definition, applying an action to it,
 * and then performing the API mutations necessary to persist the change.
 *
 * All rule groups changes should ideally be implemented as a wrapper around this hook,
 * to ensure that we always protect as best we can against accidentally overwriting changes,
 * and to guard against user concurrency issues.
 *
 * @throws
 */
export function useProduceNewRuleGroup() {
  const [fetchRuleGroup, requestState] = useLazyGetRuleGroupForNamespaceQuery();
  const [discoverDataSourceFeatures] = useLazyDiscoverDsFeaturesQuery();

  /**
   * This function will fetch the latest configuration we have for the rule group, apply a diff to it via a reducer and
   * returns the result.
   *
   * The API does not allow operations on a single rule and will always overwrite the existing rule group with the payload.
   *
   * ┌─────────────────────────┐  ┌───────────────┐  ┌──────────────────┐
   * │ fetch latest rule group │─▶│ apply reducer │─▶│  new rule group  │
   * └─────────────────────────┘  └───────────────┘  └──────────────────┘
   */
  const produceNewRuleGroup = async (ruleGroup: RuleGroupIdentifier, actions: Action[]) => {
    const { dataSourceName, groupName, namespaceName } = ruleGroup;

    const ruleSourceUid = dataSourceName === 'grafana' ? GrafanaRulesSourceSymbol : getDatasourceAPIUid(dataSourceName);
    const { rulerConfig } = await discoverDataSourceFeatures({ uid: ruleSourceUid }, PREFER_CACHE_VALUE).unwrap();
    if (!rulerConfig) {
      throw RulerNotSupportedError(dataSourceName);
    }

    const latestRuleGroupDefinition = await fetchRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      group: groupName,
      // @TODO maybe only supress if 404?
      notificationOptions: { showErrorAlert: false },
    })
      .unwrap()
      .catch(notFoundToNullOrThrow);

    const initialRuleGroupDefinition = latestRuleGroupDefinition ?? createBlankRuleGroup(groupName);
    const newRuleGroupDefinition = actions.reduce((ruleGroup, action) => {
      // This is a workaround to ensure that the interval is set correctly when adding a rule to an existing rule group.
      // The interval is set to default for DMA rules even for existing rule groups with a non-default interval.
      // We no longer allow setting the interval for existing groups, but still allow that when you create a new rule group.
      if (latestRuleGroupDefinition && addRuleAction.match(action)) {
        action.payload.interval = latestRuleGroupDefinition.interval;
      }
      return ruleGroupReducer(ruleGroup, action);
    }, initialRuleGroupDefinition);

    return { newRuleGroupDefinition, rulerConfig };
  };

  return [produceNewRuleGroup, requestState] as const;
}

const createBlankRuleGroup = (name: string): PostableRulerRuleGroupDTO => ({
  name,
  interval: DEFAULT_GROUP_EVALUATION_INTERVAL,
  rules: [],
});
