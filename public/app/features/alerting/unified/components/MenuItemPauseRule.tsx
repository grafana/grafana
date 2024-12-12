import { Menu } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { isGrafanaRulerRule, isGrafanaRulerRulePaused } from 'app/features/alerting/unified/utils/rules';
import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { usePauseRuleInGroup } from '../hooks/ruleGroup/usePauseAlertRule';
import { isLoading } from '../hooks/useAsync';
import { stringifyErrorLike } from '../utils/misc';

interface Props {
  rule: RulerRuleDTO;
  groupIdentifier: GrafanaRuleGroupIdentifier;
  /**
   * Method invoked after the request to change the paused state has completed
   */
  onPauseChange?: () => void;
}

/**
 * Menu item to display correct text for pausing/resuming an alert,
 * and triggering API call to do so
 */
const MenuItemPauseRule = ({ rule, groupIdentifier, onPauseChange }: Props) => {
  const notifyApp = useAppNotification();
  const [pauseRule, updateState] = usePauseRuleInGroup();

  const isPaused = isGrafanaRulerRule(rule) && isGrafanaRulerRulePaused(rule);
  const icon = isPaused ? 'play' : 'pause';
  const title = isPaused ? 'Resume evaluation' : 'Pause evaluation';

  /**
   * Triggers API call to update the current rule to the new `is_paused` state
   */
  const setRulePause = async (newIsPaused: boolean) => {
    if (!isGrafanaRulerRule(rule)) {
      return;
    }

    try {
      const ruleUID = rule.grafana_alert.uid;

      await pauseRule.execute(groupIdentifier, ruleUID, newIsPaused);
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
      disabled={isLoading(updateState)}
      onClick={() => {
        setRulePause(!isPaused);
      }}
    />
  );
};

export default MenuItemPauseRule;
