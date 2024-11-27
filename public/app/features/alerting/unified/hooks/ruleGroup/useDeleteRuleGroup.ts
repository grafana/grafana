import { dispatch } from 'app/store/store';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';

import { alertRuleApi } from '../../api/alertRuleApi';
import { featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { fetchPromAndRulerRulesAction } from '../../state/actions';
import { useAsync } from '../useAsync';

import { RulerNotSupportedError } from './useProduceNewRuleGroup';

const { useDeleteRuleGroupFromNamespaceMutation } = alertRuleApi;
const { useLazyDiscoverDsFeaturesQuery } = featureDiscoveryApi;

export function useDeleteRuleGroup() {
  const [deleteRuleGroup] = useDeleteRuleGroupFromNamespaceMutation();
  const [discoverDataSourceFeature] = useLazyDiscoverDsFeaturesQuery();

  return useAsync(async (ruleGroupIdentifier: RuleGroupIdentifier) => {
    const { dataSourceName, namespaceName, groupName } = ruleGroupIdentifier;

    const { rulerConfig } = await discoverDataSourceFeature({ rulesSourceName: dataSourceName }).unwrap();
    if (!rulerConfig) {
      throw RulerNotSupportedError(dataSourceName);
    }

    const result = await deleteRuleGroup({ rulerConfig, namespace: namespaceName, group: groupName }).unwrap();

    // @TODO remove this once we can use tags to invalidate
    await dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: dataSourceName }));

    return result;
  });
}
