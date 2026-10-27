import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { FeatureState, type GrafanaTheme2, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ButtonGroup, Dropdown, FeatureBadge, Icon, Menu, ToolbarButton, useStyles2, type IconName } from '@grafana/ui';
import { AssistantSparkleGradient } from 'app/core/components/AppChrome/FullscreenWorkspace/AssistantToolbarButtons';

import { canEnterComposer } from '../composer/composerAccess';
import { useAssistantComposerEntry } from '../composer/useAssistantComposerEntry';
import { isNewDashboard } from '../saving/shared';

import { type DashboardScene } from './DashboardScene';
import {
  dashboardComposerEnabled,
  dashboardModesEnabled,
  getDashboardMode,
  type DashboardMode,
} from './dashboardModes';

const COMPOSER_ICON_GRADIENT_ID = 'grafana-assistant-composer-mode-icon-gradient';

/** Set once Composer has been entered in this browser: the picker stops marking it as new. */
export const COMPOSER_SEEN_KEY = 'grafana.dashboard.composer.seen';

export function DashboardModePicker({ dashboard }: { dashboard: DashboardScene }) {
  const state = dashboard.useState();
  const styles = useStyles2(getStyles);
  const [buttonGroup, setButtonGroup] = useState<HTMLDivElement | null>(null);
  const [isCaretMenuOpen, setIsCaretMenuOpen] = useState(false);
  const mode = getDashboardMode(state);
  const [composerSeen, setComposerSeen] = useState(() => store.getBool(COMPOSER_SEEN_KEY, false));
  useEffect(() => {
    if (mode === 'composer' && !composerSeen) {
      store.set(COMPOSER_SEEN_KEY, true);
      setComposerSeen(true);
    }
  }, [mode, composerSeen]);
  const composer = useComposerOption(dashboard);
  const nextMode = mode === 'view' ? 'edit' : 'view';
  const saveRequired = isNewDashboard(state);
  const disabled = dashboard.managedResourceCannotBeEdited();
  const hidden =
    !dashboardModesEnabled() ||
    !dashboard.canEditDashboard() ||
    (!state.editable && mode === 'view') ||
    state.editPanel ||
    state.editview ||
    state.viewPanel ||
    state.planning;
  useEffect(() => {
    if (!hidden && !disabled) {
      dashboard.trackModePickerShown();
    }
  }, [dashboard, hidden, disabled]);
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
    mode === 'composer'
      ? { label: t('dashboard.modes.composer', 'Composer'), icon: 'ai-sparkle' as const }
      : options.find((option) => option.value === mode)!;
  // From Composer, Viewing and Editing first end the session, as its own exit does.
  const choose = (value: 'view' | 'edit') =>
    mode === 'composer' ? dashboard.switchFromComposer(value) : dashboard.setDashboardMode(value, 'picker');

  // The current mode is ticked; until Composer has been entered, it is marked as new instead.
  let composerBadge: typeof NewMode | undefined = composerSeen ? undefined : NewMode;
  if (mode === 'composer') {
    composerBadge = SelectedMode;
  }

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
        {composer && (
          <Menu.Item
            label={t('dashboard.modes.composer', 'Composer')}
            description={
              composer.disabledReason ??
              t('dashboard.modes.composer-description', 'Point at anything and ask Assistant to change it.')
            }
            // The Assistant sparkle in the Chat button's colours; disabled, it greys out like the others.
            icon="ai-sparkle"
            role="menuitemradio"
            ariaChecked={mode === 'composer'}
            disabled={composer.disabledReason !== undefined}
            className={cx(styles.item, composer.disabledReason === undefined && styles.assistantIcon)}
            component={composerBadge}
            // Already in Composer: nothing to do.
            onClick={mode === 'composer' ? undefined : composer.request}
          />
        )}
      </Menu>
    </div>
  );

  return (
    <>
      {/* Outside the group: a child there would end the main button's :first-child rounding. */}
      {(composer || mode === 'composer') && <AssistantSparkleGradient id={COMPOSER_ICON_GRADIENT_ID} />}
      <ButtonGroup ref={setButtonGroup}>
        <ToolbarButton
          variant="canvas"
          icon={current.icon}
          className={cx(mode === 'composer' && styles.assistantIcon)}
          aria-label={t('dashboard.modes.current', 'Dashboard mode: {{mode}}', { mode: current.label })}
          tooltip={
            saveRequired && nextMode === 'view'
              ? saveBeforeViewing
              : nextMode === 'view'
                ? t('dashboard.modes.switch-to-viewing', 'Switch to Viewing')
                : t('dashboard.modes.switch-to-editing', 'Switch to Editing')
          }
          disabled={disabled || (!state.editable && nextMode === 'edit')}
          onClick={() => choose(nextMode)}
        >
          {current.label}
        </ToolbarButton>
        <Dropdown
          positioningReference={buttonGroup}
          placement="bottom-end"
          onVisibleChange={(visible) => {
            setIsCaretMenuOpen(visible);
            if (visible) {
              dashboard.trackModePickerOpened();
            }
          }}
          overlay={menu}
        >
          <ToolbarButton
            variant="canvas"
            icon={isCaretMenuOpen ? 'angle-up' : 'angle-down'}
            aria-label={t('dashboard.modes.change-mode', 'Change dashboard mode')}
            aria-haspopup="menu"
            disabled={disabled}
          />
        </Dropdown>
      </ButtonGroup>
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
  if (getDashboardMode(dashboard.state) === 'composer') {
    return { disabledReason: undefined, request: () => {} };
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
  const request = () => entry.request({ resource: 'dashboard', uid: dashboard.state.uid ?? '' });
  return { disabledReason, request };
}

/** Composer is a new mode, marked as Grafana marks new items in the navigation. */
function NewMode() {
  const styles = useStyles2(getStyles);
  return (
    <span className={styles.newBadge}>
      <FeatureBadge featureState={FeatureState.new} />
    </span>
  );
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
    // Where the check sits for the current mode, beside the label; it keeps its own colours, not Composer's gradient.
    newBadge: css({
      position: 'absolute',
      right: theme.spacing(1.5),
      top: theme.spacing(1.5),
      '&& svg path': { fill: 'currentColor', stroke: 'none' },
    }),
    assistantIcon: css({
      '& svg': { opacity: 1 },
      '& svg path': {
        fill: `url(#${COMPOSER_ICON_GRADIENT_ID})`,
        stroke: `url(#${COMPOSER_ICON_GRADIENT_ID})`,
      },
    }),
  };
}
