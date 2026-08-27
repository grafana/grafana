import { useCallback, useMemo, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Dropdown, Menu } from '@grafana/ui';
import { type GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import MoreButton from '../../components/MoreButton';
import SilenceGrafanaRuleDrawer from '../../components/silences/SilenceGrafanaRuleDrawer';
import { isGranted, isLoading, isNotSupported } from '../../hooks/abilities/abilityUtils';
import { useRuleSilenceAbility } from '../../hooks/abilities/rules/rulerRuleAbilities';
import { useCombinedRule } from '../../hooks/useCombinedRule';
import { rulesNav } from '../../utils/navigation';

interface AlertRuleRowActionsProps {
  ruleUID: string;
  ruleName: string;
}

/**
 * Actions you can take on a rule straight from the list, so the things you most often want to do
 * with a firing rule don't cost you the filters you just set up.
 */
export function AlertRuleRowActions({ ruleUID, ruleName }: AlertRuleRowActionsProps) {
  const [showSilenceDrawer, setShowSilenceDrawer] = useState(false);

  const handleSilence = useCallback(() => setShowSilenceDrawer(true), []);
  const handleSilenceClose = useCallback(() => setShowSilenceDrawer(false), []);

  // The menu contents are only built while the menu is open. Working out whether someone may
  // silence a rule means fetching the rule and its folder, and we don't want to do that for
  // every row in the list up front.
  const menu = useCallback(
    () => <AlertRuleActionsMenu ruleUID={ruleUID} onSilence={handleSilence} />,
    [ruleUID, handleSilence]
  );

  return (
    <>
      <Dropdown overlay={menu} placement="bottom-end">
        <MoreButton
          size="sm"
          fill="outline"
          aria-label={t('alerting.triage.rule-actions-aria-label', 'More actions for {{ruleName}}', { ruleName })}
          data-testid={selectors.pages.Alerting.Triage.ruleActionsButton}
        />
      </Dropdown>
      {showSilenceDrawer && <SilenceGrafanaRuleDrawer ruleUid={ruleUID} onClose={handleSilenceClose} />}
    </>
  );
}

interface AlertRuleActionsMenuProps {
  ruleUID: string;
  onSilence: () => void;
}

function AlertRuleActionsMenu({ ruleUID, onSilence }: AlertRuleActionsMenuProps) {
  const ruleIdentifier: GrafanaRuleIdentifier = useMemo(() => ({ uid: ruleUID, ruleSourceName: 'grafana' }), [ruleUID]);

  return (
    <Menu>
      <SilenceMenuItem ruleIdentifier={ruleIdentifier} onSilence={onSilence} />
      <Menu.Item
        label={t('alerting.triage.view-alert-rule', 'View alert rule')}
        icon="eye"
        url={rulesNav.detailsPageLink('grafana', ruleIdentifier)}
        target="_blank"
      />
    </Menu>
  );
}

interface SilenceMenuItemProps {
  ruleIdentifier: GrafanaRuleIdentifier;
  onSilence: () => void;
}

function SilenceMenuItem({ ruleIdentifier, onSilence }: SilenceMenuItemProps) {
  const { error, result: rule } = useCombinedRule({ ruleIdentifier });
  const silenceAbility = useRuleSilenceAbility(rule?.rulerRule);

  const label = t('alerting.triage.silence-notifications', 'Silence notifications');

  if (error) {
    return (
      <Menu.Item
        label={label}
        icon="bell-slash"
        disabled
        description={t('alerting.triage.silence-rule-load-failed', 'Could not load this alert rule')}
      />
    );
  }

  // Keep the item in place while the rule and its folder permissions are on their way, so the menu
  // doesn't jump around, and spin so a disabled item doesn't look broken. Matching a rule by UID
  // needs the ruler half of it, so a rule we have is always one we can ask about silencing.
  if (!rule || isLoading(silenceAbility)) {
    return <Menu.Item label={label} icon="spinner" disabled />;
  }

  // Alert instances only go to an external Alertmanager, so there is nothing for us to silence.
  if (isNotSupported(silenceAbility)) {
    return null;
  }

  const allowed = isGranted(silenceAbility);

  return (
    <Menu.Item
      label={label}
      icon="bell-slash"
      disabled={!allowed}
      description={
        allowed
          ? undefined
          : t('alerting.triage.silence-no-permission', 'You do not have permission to create silences')
      }
      onClick={onSilence}
    />
  );
}
