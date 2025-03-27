import { Action } from '@reduxjs/toolkit';

import { RuleGroupIdentifier } from 'app/types/unified-alerting';
import { PostableRulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { notFoundToNullOrThrow } from '../../api/util';
import { ruleGroupReducer } from '../../reducers/ruler/ruleGroups';
import { DEFAULT_GROUP_EVALUATION_INTERVAL } from '../../rule-editor/formDefaults';

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
  const produceNewRuleGroup = async (ruleGroup: RuleGroupIdentifier, action: Action) => {
    const { dataSourceName, groupName, namespaceName } = ruleGroup;

    const { rulerConfig } = await discoverDataSourceFeatures({ rulesSourceName: dataSourceName }).unwrap();
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

    const newRuleGroupDefinition = ruleGroupReducer(
      latestRuleGroupDefinition ?? createBlankRuleGroup(ruleGroup.groupName),
      action
    );

    return { newRuleGroupDefinition, rulerConfig };
  };

  return [produceNewRuleGroup, requestState] as const;
}

const createBlankRuleGroup = (name: string): PostableRulerRuleGroupDTO => ({
  name,
  interval: DEFAULT_GROUP_EVALUATION_INTERVAL,
  rules: [],
});
