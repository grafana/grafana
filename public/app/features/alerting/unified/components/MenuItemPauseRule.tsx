import { Menu } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { usePauseRuleInGroup } from '../hooks/ruleGroup/usePauseAlertRule';
import { isLoading } from '../hooks/useAsync';
import { stringifyErrorLike } from '../utils/misc';
import { isGrafanaRulerRulePaused } from '../utils/rules';

interface Props {
  rule: RulerGrafanaRuleDTO;
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

  const [icon, title] = isGrafanaRulerRulePaused(rule)
    ? ['play' as const, 'Resume evaluation']
    : ['pause' as const, 'Pause evaluation'];

  /**
   * Triggers API call to update the current rule to the new `is_paused` state
   */
  const setRulePause = async (newIsPaused: boolean) => {
    try {
      await pauseRule.execute(groupIdentifier, rule.grafana_alert.uid, newIsPaused);
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
        setRulePause(!rule.grafana_alert.is_paused);
      }}
    />
  );
};

export default MenuItemPauseRule;
