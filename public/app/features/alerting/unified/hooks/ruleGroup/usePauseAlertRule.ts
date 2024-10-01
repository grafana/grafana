import { t } from 'app/core/internationalization';
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

  const rulePausedMessage = t('alerting.rules.pause-rule.success', 'Rule evaluation paused');
  const ruleResumedMessage = t('alerting.rules.resume-rule.success', 'Rule evaluation resumed');

  return useAsync(async (ruleGroup: RuleGroupIdentifier, uid: string, pause: boolean) => {
    const { namespaceName } = ruleGroup;

    const action = pauseRuleAction({ uid, pause });
    const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(ruleGroup, action);

    return upsertRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      payload: newRuleGroupDefinition,
      notificationOptions: {
        successMessage: pause ? rulePausedMessage : ruleResumedMessage,
      },
    }).unwrap();
  });
}
