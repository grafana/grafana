import { produce } from 'immer';
import React from 'react';

import { Menu } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { isGrafanaRulerRule, isGrafanaRulerRulePaused } from 'app/features/alerting/unified/utils/rules';
import { CombinedRule } from 'app/types/unified-alerting';

import { grafanaRulerConfig } from '../hooks/useCombinedRule';

interface Props {
  rule: CombinedRule;
  /**
   * Method invoked after the request to change the paused state has completed
   */
  onPauseChange?: () => void;
}

/**
 * Menu item to display correct text for pausing/resuming an alert,
 * and triggering API call to do so
 */
const MenuItemPauseRule = ({ rule, onPauseChange }: Props) => {
  // we need to fetch the group again, as maybe the group has been filtered
  const [getGroup] = alertRuleApi.endpoints.rulerRuleGroup.useLazyQuery();
  const notifyApp = useAppNotification();

  // Add any dependencies here
  const [updateRule] = alertRuleApi.endpoints.updateRule.useMutation();
  const isPaused = isGrafanaRulerRule(rule.rulerRule) && isGrafanaRulerRulePaused(rule.rulerRule);
  const icon = isPaused ? 'play' : 'pause';
  const title = isPaused ? 'Resume evaluation' : 'Pause evaluation';

  /**
   * Triggers API call to update the current rule to the new `is_paused` state
   */
  const setRulePause = async (newIsPaused: boolean) => {
    if (!isGrafanaRulerRule(rule.rulerRule)) {
      return;
    }
    const ruleUid = rule.rulerRule.grafana_alert.uid;
    const targetGroup = await getGroup({
      rulerConfig: grafanaRulerConfig,
      namespace: rule.namespace.uid || rule.rulerRule.grafana_alert.namespace_uid,
      group: rule.group.name,
    }).unwrap();

    if (!targetGroup) {
      notifyApp.error(
        `Failed to ${newIsPaused ? 'pause' : 'resume'} the rule. Could not get the target group to update the rule.`
      );
      return;
    }

    // Parse the rules into correct format for API
    const modifiedRules = targetGroup.rules.map((groupRule) => {
      if (!(isGrafanaRulerRule(groupRule) && groupRule.grafana_alert.uid === ruleUid)) {
        return groupRule;
      }
      return produce(groupRule, (updatedGroupRule) => {
        updatedGroupRule.grafana_alert.is_paused = newIsPaused;
      });
    });

    const payload = {
      interval: targetGroup.interval!,
      name: targetGroup.name,
      rules: modifiedRules,
    };

    await updateRule({
      nameSpaceUID: rule.namespace.uid || rule.rulerRule.grafana_alert.namespace_uid,
      payload,
    }).unwrap();

    onPauseChange?.();
  };

  return (
    <Menu.Item
      label={title}
      icon={icon}
      onClick={() => {
        setRulePause(!isPaused);
      }}
    />
  );
};

export default MenuItemPauseRule;
