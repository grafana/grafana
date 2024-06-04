import React from 'react';

import { Menu } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import {
  isGrafanaRulerRule,
  isGrafanaRulerRulePaused,
  getRuleGroupLocation,
} from 'app/features/alerting/unified/utils/rules';
import { CombinedRule } from 'app/types/unified-alerting';

import { usePauseRuleInGroup } from '../hooks/useProduceNewEvaluationGroup';
import { stringifyErrorLike } from '../utils/misc';

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
  const notifyApp = useAppNotification();
  const [pauseRule, _updateState] = usePauseRuleInGroup();

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

    try {
      const location = getRuleGroupLocation(rule);
      await pauseRule(location, rule.rulerRule, newIsPaused);
    } catch (error) {
      notifyApp.error(`Failed to ${newIsPaused ? 'pause' : 'resume'} the rule: ${stringifyErrorLike(error)}`);
      return;
    }

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
