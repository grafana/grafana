import { css } from '@emotion/css';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, Icon, Menu, ToolbarButton, Tooltip, useStyles2, type IconName } from '@grafana/ui';

import { canEnterComposer } from '../composer/composerAccess';
import { getPendingComposerEnterTarget, subscribeToComposerEnterRequests } from '../composer/composerEntryRequests';
import { useAssistantComposerEntry } from '../composer/useAssistantComposerEntry';
import { isNewDashboard } from '../saving/shared';
import { useIsMobileEditDeprecated } from '../utils/mobileEditDeprecation';

import { type DashboardScene } from './DashboardScene';
import {
  dashboardComposerEnabled,
  dashboardModesEnabled,
  getDashboardMode,
  getPickerMode,
  isComposerMode,
  type DashboardMode,
} from './dashboardModes';

export function DashboardModePicker({ dashboard }: { dashboard: DashboardScene }) {
  const state = dashboard.useState();
  const styles = useStyles2(getStyles);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // In Composer the picker shows and switches the mode Composer is over; Composer stays on.
  const mode = getPickerMode(state);
  const inComposer = isComposerMode(state);
  const composer = useComposerOption(dashboard);
  const isMobileEditDeprecated = useIsMobileEditDeprecated();
  const editBlockedOnMobile = isMobileEditDeprecated && mode === 'view';
  const saveRequired = isNewDashboard(state);
  const hidden =
    !dashboardModesEnabled() ||
    !dashboard.canEditDashboard() ||
    (!state.editable && mode === 'view') ||
    state.editPanel ||
    state.editview ||
    state.viewPanel ||
    state.planning;
  useEffect(() => {
    if (!hidden) {
      dashboard.trackModePickerShown();
    }
  }, [dashboard, hidden]);
  if (hidden) {
    return null;
  }

  const saveBeforeViewing = t('dashboard.modes.save-before-viewing', 'Save the dashboard before switching to Viewing.');

  const options: Array<{ value: DashboardMode; label: string; description: string; icon: IconName }> = [
    {
      value: 'view',
      label: t('dashboard.modes.view', 'Viewing'),
      description: saveRequired
        ? saveBeforeViewing
        : t('dashboard.modes.view-description', 'View and explore the dashboard.'),
      icon: 'eye',
    },
    {
      value: 'edit',
      label: t('dashboard.modes.edit', 'Editing'),
      description: t('dashboard.modes.edit-description', 'Manually edit panels, layout, and settings.'),
      icon: 'pen',
    },
  ];
  const current =
    mode === 'agent'
      ? { label: t('dashboard.modes.agent-edit', 'Agent editing'), icon: 'pen' as const }
      : options.find((option) => option.value === mode)!;
  const choose = (value: 'view' | 'edit') =>
    inComposer ? dashboard.setComposerEditing(value === 'edit') : dashboard.setDashboardMode(value, 'picker');

  const menu = (
    <div className={styles.menu}>
      <Menu ariaLabel={t('dashboard.modes.label', 'Dashboard mode')}>
        {options.map((option) => (
          <Menu.Item
            key={option.value}
            label={option.label}
            description={option.description}
            icon={option.icon}
            role="menuitemradio"
            ariaChecked={mode === option.value}
            disabled={!state.editable && option.value !== 'view'}
            className={styles.item}
            component={mode === option.value ? SelectedMode : undefined}
            onClick={() => choose(option.value === 'view' ? 'view' : 'edit')}
          />
        ))}
      </Menu>
    </div>
  );

  return (
    <>
      <Dropdown
        placement="bottom-end"
        onVisibleChange={(visible) => {
          setIsMenuOpen(visible);
          if (visible) {
            dashboard.trackModePickerOpened();
          }
        }}
        overlay={menu}
      >
        <ToolbarButton
          variant="canvas"
          icon={current.icon}
          isOpen={isMenuOpen}
          aria-label={t('dashboard.modes.current', 'Dashboard mode: {{mode}}', { mode: current.label })}
          aria-haspopup="menu"
          disabled={editBlockedOnMobile}
        >
          {current.label}
        </ToolbarButton>
      </Dropdown>
      {composer && (inComposer || !isMobileEditDeprecated) && (
        <Tooltip
          placement="bottom"
          content={
            composer.disabledReason ??
            (composer.opening
              ? t('dashboard.modes.composer-opening', 'Opening Composer…')
              : t('dashboard.modes.composer-description', 'Point at anything and ask the Assistant.'))
          }
        >
          <ToolbarButton
            variant={inComposer ? 'active' : 'canvas'}
            icon={composer.opening ? 'spinner' : 'ai-select'}
            aria-label={t('dashboard.modes.composer', 'Composer')}
            aria-pressed={inComposer}
            aria-busy={composer.opening}
            disabled={composer.disabledReason !== undefined}
            onClick={inComposer ? () => dashboard.leaveComposer() : composer.request}
          />
        </Tooltip>
      )}
    </>
  );
}

/**
 * Composer in the picker: offered while its flag is on, Assistant's sidebar can be shown and Assistant listens
 * for dashboard entry requests. Choosing it
 * opens that sidebar if needed and asks Assistant to enter Composer; core never enters it itself.
 */
function useComposerOption(dashboard: DashboardScene) {
  const entry = useAssistantComposerEntry('dashboard');
  const pending = useSyncExternalStore(subscribeToComposerEnterRequests, getPendingComposerEnterTarget);
  if (getDashboardMode(dashboard.state) === 'composer') {
    return { disabledReason: undefined, opening: false, request: () => {} };
  }
  if (!dashboardComposerEnabled() || !entry) {
    return undefined;
  }
  const check = canEnterComposer(dashboard);
  if (!check.ok && check.reason === 'no_document') {
    return undefined;
  }
  let disabledReason: string | undefined;
  if (!check.ok && check.reason === 'no_permission') {
    disabledReason = t('dashboard.modes.composer-no-permission', 'You need permission to edit this dashboard.');
  } else if (!check.ok) {
    disabledReason = isNewDashboard(dashboard.state)
      ? t('dashboard.modes.composer-save-first', 'Save the dashboard before using Composer.')
      : t('dashboard.modes.composer-unsupported', 'Composer is not available for this dashboard right now.');
  }
  const uid = dashboard.state.uid ?? '';
  // Kept enabled while opening so keyboard focus stays on the button; a second press is ignored.
  const opening = pending?.resource === 'dashboard' && pending.uid === uid;
  const request = () => {
    if (!opening) {
      entry.request({ resource: 'dashboard', uid });
    }
  };
  return { disabledReason, opening, request };
}

function SelectedMode() {
  const styles = useStyles2(getStyles);
  return <Icon name="check" className={styles.check} aria-hidden />;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    menu: css({ width: 360, maxWidth: 'calc(100vw - 32px)', '> [role="menu"]': { width: '100%' } }),
    item: css({ padding: theme.spacing(1.5, 5, 1.5, 1.5) }),
    check: css({ position: 'absolute', right: theme.spacing(1.5), top: theme.spacing(1.5) }),
  };
}
