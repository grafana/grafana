import { t } from '@grafana/i18n';
import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';

import { alertRuleApi } from '../../api/alertRuleApi';
import { pauseRuleAction } from '../../reducers/ruler/ruleGroups';
import { ruleGroupIdentifierV2toV1 } from '../../utils/groupIdentifier';
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

  return useAsync(async (ruleGroup: GrafanaRuleGroupIdentifier, uid: string, pause: boolean) => {
    const groupIdentifierV1 = ruleGroupIdentifierV2toV1(ruleGroup);

    const action = pauseRuleAction({ uid, pause });
    const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(groupIdentifierV1, [action]);

    return upsertRuleGroup({
      rulerConfig,
      namespace: ruleGroup.namespace.uid,
      payload: newRuleGroupDefinition,
      notificationOptions: {
        successMessage: pause ? rulePausedMessage : ruleResumedMessage,
      },
    }).unwrap();
  });
}
