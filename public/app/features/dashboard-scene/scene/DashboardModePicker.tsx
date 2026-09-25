import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ButtonGroup, Dropdown, Icon, Menu, ToolbarButton, useStyles2, type IconName } from '@grafana/ui';

import { type DashboardScene } from './DashboardScene';
import { dashboardModesEnabled, getDashboardMode, type DashboardMode } from './dashboardModes';

export function DashboardModePicker({ dashboard }: { dashboard: DashboardScene }) {
  const state = dashboard.useState();
  const styles = useStyles2(getStyles);
  const [buttonGroup, setButtonGroup] = useState<HTMLDivElement | null>(null);
  const [isLabelMenuOpen, setIsLabelMenuOpen] = useState(false);
  const [isCaretMenuOpen, setIsCaretMenuOpen] = useState(false);
  const mode = getDashboardMode(state);
  if (
    !dashboardModesEnabled() ||
    !dashboard.canEditDashboard() ||
    (!state.editable && mode === 'view') ||
    state.editPanel ||
    state.editview ||
    state.viewPanel ||
    state.planning
  ) {
    return null;
  }

  const options: Array<{ value: DashboardMode; label: string; description: string; icon: IconName }> = [
    {
      value: 'view',
      label: t('dashboard.modes.view', 'Viewing'),
      description: t('dashboard.modes.view-description', 'View and explore the dashboard.'),
      icon: 'eye',
    },
    {
      value: 'edit',
      label: t('dashboard.modes.edit', 'Editing'),
      description: t('dashboard.modes.edit-description', 'Manually edit panels, layout, and settings.'),
      icon: 'pen',
    },
    {
      value: 'code',
      label: t('dashboard.modes.code', 'Code'),
      description: t('dashboard.modes.code-description', 'Edit the dashboard as JSON or YAML.'),
      icon: 'brackets-curly',
    },
  ];
  const current = options.find((option) => option.value === mode)!;

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
            onClick={() => dashboard.setDashboardMode(option.value)}
          />
        ))}
      </Menu>
    </div>
  );
  const disabled = dashboard.managedResourceCannotBeEdited();

  return (
    <ButtonGroup ref={setButtonGroup}>
      <Dropdown
        positioningReference={buttonGroup}
        placement="bottom-end"
        onVisibleChange={setIsLabelMenuOpen}
        overlay={menu}
      >
        <ToolbarButton
          variant="canvas"
          icon={current.icon}
          aria-label={t('dashboard.modes.current', 'Dashboard mode: {{mode}}', { mode: current.label })}
          aria-haspopup="menu"
          disabled={disabled}
        >
          {current.label}
        </ToolbarButton>
      </Dropdown>
      <Dropdown
        positioningReference={buttonGroup}
        placement="bottom-end"
        onVisibleChange={setIsCaretMenuOpen}
        overlay={menu}
      >
        <ToolbarButton
          variant="canvas"
          icon={isLabelMenuOpen || isCaretMenuOpen ? 'angle-up' : 'angle-down'}
          aria-label={t('dashboard.modes.change-mode', 'Change dashboard mode')}
          aria-haspopup="menu"
          disabled={disabled}
        />
      </Dropdown>
    </ButtonGroup>
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
  };
}
