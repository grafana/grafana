import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { useCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Dropdown } from '../../../Dropdown/Dropdown';
import { IconButton } from '../../../IconButton/IconButton';
import { Menu } from '../../../Menu/Menu';
import { MenuItem } from '../../../Menu/MenuItem';

interface HeaderColumnMenuProps {
  displayName: string;
  onHideColumn: () => void;
  canHideColumn: boolean;
}

export function HeaderColumnMenu({ displayName, onHideColumn, canHideColumn }: HeaderColumnMenuProps) {
  const styles = useStyles2(getStyles);

  const overlay = useCallback(
    () => (
      <Menu ariaLabel={t('grafana-ui.table.column-menu', 'Column menu for {{name}}', { name: displayName })}>
        <MenuItem
          label={t('grafana-ui.table.hide-column', 'Hide column')}
          icon="eye-slash"
          disabled={!canHideColumn}
          onClick={() => onHideColumn()}
        />
      </Menu>
    ),
    [canHideColumn, displayName, onHideColumn]
  );

  return (
    <div
      className={styles.menuWrapper}
      onClick={(ev) => ev.stopPropagation()}
      onMouseDown={(ev) => ev.stopPropagation()}
    >
      <Dropdown overlay={overlay} placement="bottom-end">
        <IconButton
          className={styles.menuButton}
          name="ellipsis-v"
          size="sm"
          aria-label={t('grafana-ui.table.column-menu', 'Column menu for {{name}}', { name: displayName })}
        />
      </Dropdown>
    </div>
  );
}

const getStyles = memoize((theme: GrafanaTheme2) => ({
  menuWrapper: css({
    label: 'headerColumnMenuWrapper',
    pointerEvents: 'auto',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  }),
  menuButton: css({
    label: 'headerColumnMenuButton',
    width: 28,
    height: 28,
    marginRight: `${theme.spacing(0.5)} !important`,
    padding: `${theme.spacing(0.5)} !important`,
    opacity: 0,
    color: theme.colors.text.secondary,
    transition: 'opacity 0.15s ease',
    '.rdg-cell:hover &, .rdg-cell:focus-within &': {
      opacity: 1,
    },
  }),
}));
