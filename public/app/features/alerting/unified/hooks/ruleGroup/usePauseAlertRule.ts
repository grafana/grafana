import { t } from 'i18next';

import { RuleGroupIdentifier } from 'app/types/unified-alerting';

import { alertRuleApi } from '../../api/alertRuleApi';
import { pauseRuleAction } from '../../reducers/ruler/ruleGroups';
import { useAsync } from '../useAsync';

import { useProduceNewRuleGroup } from './useProduceNewRuleGroup';

/**
 * Pause a single rule in a (ruler) group. This hook will ensure that mutations on the rule group are safe and will always
 * use the latest definition of the ruler group identifier.
 */
export function usePauseRuleInGroup() {
  const [produceNewRuleGroup] = useProduceNewRuleGroup();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();

  return useAsync(async (ruleGroup: RuleGroupIdentifier, uid: string, pause: boolean) => {
    const { namespaceName } = ruleGroup;

    const action = pauseRuleAction({ uid, pause });
    const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(ruleGroup, action);

    const rulePauseMessage = t('alerting.rules.pause-rule.success', 'Rule evaluation paused');
    const ruleResumeMessage = t('alerting.rules.resume-rule.success', 'Rule evaluation resumed');

    return upsertRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      payload: newRuleGroupDefinition,
      requestOptions: {
        successMessage: pause ? rulePauseMessage : ruleResumeMessage,
      },
    }).unwrap();
  });
}
