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
  isPinned: boolean;
  onTogglePin?: () => void;
}

export function HeaderColumnMenu({
  displayName,
  onHideColumn,
  canHideColumn,
  isPinned,
  onTogglePin,
}: HeaderColumnMenuProps) {
  const styles = useStyles2(getStyles);

  const overlay = useCallback(
    () => (
      <Menu ariaLabel={t('grafana-ui.table.column-menu', 'Column menu for {{name}}', { name: displayName })}>
        {onTogglePin && (
          <MenuItem
            label={
              isPinned
                ? t('grafana-ui.table.unpin-column', 'Unpin column')
                : t('grafana-ui.table.pin-column-left', 'Pin column left')
            }
            icon="gf-pin"
            onClick={() => onTogglePin()}
          />
        )}
        <MenuItem
          label={t('grafana-ui.table.hide-column', 'Hide column')}
          icon="eye-slash"
          disabled={!canHideColumn}
          onClick={() => onHideColumn()}
        />
      </Menu>
    ),
    [canHideColumn, displayName, isPinned, onHideColumn, onTogglePin]
  );

  return (
    // The inner IconButton owns keyboard interaction. This wrapper only prevents its pointer
    // events from bubbling to react-data-grid's header sort handler.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
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
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'opacity 0.15s ease',
    },
    '.rdg-cell:hover &, .rdg-cell:focus-within &': {
      opacity: 1,
    },
  }),
}));
