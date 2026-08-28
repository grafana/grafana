import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Dropdown, Menu, Spinner, useStyles2 } from '@grafana/ui';
import { type GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import MoreButton from '../../components/MoreButton';
import SilenceGrafanaRuleDrawer from '../../components/silences/SilenceGrafanaRuleDrawer';
import { rulesNav } from '../../utils/navigation';
import { useCanSilenceRule } from '../hooks/useCanSilenceRule';

interface AlertRuleRowActionsProps {
  ruleUID: string;
  ruleName: string;
}

/**
 * Actions you can take on a rule straight from the triage list, so the things you most often want
 * to do with a firing rule don't cost you the filters you just set up.
 */
export function AlertRuleRowActions({ ruleUID, ruleName }: AlertRuleRowActionsProps) {
  const [showSilenceDrawer, setShowSilenceDrawer] = useState(false);

  const handleSilence = useCallback(() => setShowSilenceDrawer(true), []);
  const handleSilenceClose = useCallback(() => setShowSilenceDrawer(false), []);

  // Both of these are stable so that opening the menu, and anything happening inside it, can't
  // re-render the Dropdown itself - it is memoized on exactly these two props.
  const overlay = useCallback(
    () => <ActionsMenu ruleUID={ruleUID} onSilence={handleSilence} />,
    [ruleUID, handleSilence]
  );

  const trigger = useMemo(
    () => (
      <MoreButton
        size="sm"
        fill="outline"
        title={t('alerting.triage.rule-actions', 'Actions')}
        aria-label={t('alerting.triage.rule-actions-aria-label', 'Actions for {{ruleName}}', { ruleName })}
        data-testid={selectors.pages.Alerting.Triage.ruleActionsButton}
      />
    ),
    [ruleName]
  );

  return (
    <>
      <Dropdown overlay={overlay} placement="bottom-end">
        {trigger}
      </Dropdown>
      {showSilenceDrawer && <SilenceGrafanaRuleDrawer ruleUid={ruleUID} onClose={handleSilenceClose} />}
    </>
  );
}

interface ActionsMenuProps {
  ruleUID: string;
  onSilence: () => void;
}

/**
 * Mounted only while the menu is open, so nothing is fetched for rules nobody asked about.
 *
 * Whether the rule can be silenced decides which items belong here, so the menu waits for that
 * rather than adding the silence item late and shifting everything under it.
 */
function ActionsMenu({ ruleUID, onSilence }: ActionsMenuProps) {
  const styles = useStyles2(getStyles);
  const { loading, canSilence } = useCanSilenceRule(ruleUID);

  const ruleIdentifier: GrafanaRuleIdentifier = useMemo(() => ({ uid: ruleUID, ruleSourceName: 'grafana' }), [ruleUID]);

  // Keeping the same Menu element across the swap means React updates its contents in place - the
  // menu is never unmounted and re-created, so it doesn't blink or jump away from the button.
  return (
    <Menu>
      {loading ? (
        <div className={styles.loading} role="status" aria-label={t('alerting.triage.loading-actions', 'Loading')}>
          <Spinner inline size="sm" />
        </div>
      ) : (
        <>
          {canSilence && (
            <Menu.Item
              label={t('alerting.triage.silence-notifications', 'Silence notifications')}
              icon="bell-slash"
              onClick={onSilence}
            />
          )}
          <Menu.Item
            label={t('alerting.triage.view-alert-rule', 'View alert rule')}
            icon="eye"
            url={rulesNav.detailsPageLink('grafana', ruleIdentifier)}
            target="_blank"
          />
        </>
      )}
    </Menu>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Roughly the width the loaded items take, so the menu doesn't visibly resize around the spinner.
  // It is anchored by its top edge, so what growth is left happens downwards and stays put.
  loading: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: theme.spacing(25),
    minHeight: theme.spacing(4),
    padding: theme.spacing(0.5, 1.5),
  }),
});
