import { Menu } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';

import { usePauseRuleInGroup } from '../hooks/ruleGroup/usePauseAlertRule';
import { isLoading } from '../hooks/useAsync';
import { stringifyErrorLike } from '../utils/misc';

interface Props {
  uid: string;
  isPaused: boolean;
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
const MenuItemPauseRule = ({ uid, isPaused, groupIdentifier, onPauseChange }: Props) => {
  const notifyApp = useAppNotification();
  const [pauseRule, updateState] = usePauseRuleInGroup();

  const [icon, title] = isPaused ? ['play' as const, 'Resume evaluation'] : ['pause' as const, 'Pause evaluation'];

  /**
   * Triggers API call to update the current rule to the new `is_paused` state
   */
  const setRulePause = async (newIsPaused: boolean) => {
    try {
      await pauseRule.execute(groupIdentifier, uid, newIsPaused);
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
