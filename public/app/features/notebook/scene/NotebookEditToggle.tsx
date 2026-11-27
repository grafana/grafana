import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Dropdown, Icon, Menu, ToolbarButton, useStyles2, type IconName } from '@grafana/ui';

import { canEditNotebooks } from '../permissions';

import { type NotebookScene } from './NotebookScene';

/**
 * Switches the notebook between viewing and editing. A single dropdown that names the current mode,
 * matching the dashboard mode picker. The mode itself lives on the scene — this only flips it.
 */
export function NotebookEditToggle({ notebook }: { notebook: NotebookScene }) {
  const { isEditing } = notebook.useState();
  const styles = useStyles2(getStyles);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Offered only to users who can act on it. The scene refuses to enter edit mode without the same
  // permission, so hiding the control is presentation, not enforcement.
  if (!canEditNotebooks()) {
    return null;
  }

  const options: Array<{ editing: boolean; label: string; description: string; icon: IconName }> = [
    {
      editing: false,
      label: t('notebooks.view.mode-viewing', 'Viewing'),
      description: t('notebooks.view.mode-view-description', 'View and explore the notebook.'),
      icon: 'eye',
    },
    {
      editing: true,
      label: t('notebooks.view.mode-editing', 'Editing'),
      description: t('notebooks.view.mode-edit-description', 'Edit text and panels.'),
      icon: 'pen',
    },
  ];
  const current = options.find((option) => option.editing === Boolean(isEditing))!;
  const choose = (editing: boolean) => {
    // Re-entering the current mode would restart the edit session.
    if (editing === current.editing) {
      return;
    }
    if (editing) {
      notebook.onEnterEditMode();
    } else {
      notebook.onExitEditMode();
    }
  };

  const menu = (
    <div className={styles.menu}>
      <Menu ariaLabel={t('notebooks.view.mode-label', 'Notebook mode')}>
        {options.map((option) => (
          <Menu.Item
            key={option.label}
            label={option.label}
            description={option.description}
            icon={option.icon}
            role="menuitemradio"
            ariaChecked={option === current}
            className={styles.item}
            component={option === current ? SelectedMode : undefined}
            onClick={() => choose(option.editing)}
          />
        ))}
      </Menu>
    </div>
  );

  return (
    <Dropdown placement="bottom-end" onVisibleChange={setIsMenuOpen} overlay={menu}>
      <ToolbarButton
        variant="canvas"
        icon={current.icon}
        isOpen={isMenuOpen}
        aria-label={t('notebooks.view.mode-current', 'Notebook mode: {{mode}}', { mode: current.label })}
        aria-haspopup="menu"
        data-testid={selectors.pages.Notebooks.Item.editModeToggle}
      >
        {current.label}
      </ToolbarButton>
    </Dropdown>
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
