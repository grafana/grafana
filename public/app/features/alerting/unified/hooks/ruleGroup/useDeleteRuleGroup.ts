import { dispatch, getState } from 'app/store/store';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';

import { alertRuleApi } from '../../api/alertRuleApi';
import { fetchPromAndRulerRulesAction, getDataSourceRulerConfig } from '../../state/actions';
import { useAsync } from '../useAsync';

export function useDeleteRuleGroup() {
  const [deleteRuleGroup] = alertRuleApi.endpoints.deleteRuleGroupFromNamespace.useMutation();

  return useAsync(async (ruleGroupIdentifier: RuleGroupIdentifier) => {
    const { dataSourceName, namespaceName, groupName } = ruleGroupIdentifier;

    // @TODO get rid of getState, *sigh*
    const rulerConfig = getDataSourceRulerConfig(getState, dataSourceName);

    const result = await deleteRuleGroup({ rulerConfig, namespace: namespaceName, group: groupName }).unwrap();

    // @TODO remove this once we can use tags to invalidate
    await dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: dataSourceName }));

    return result;
  });
}
