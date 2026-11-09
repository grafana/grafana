import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, IconButton, Menu, useStyles2 } from '@grafana/ui';

import { NOTEBOOK_CELL_CONTROLS_PINNED_CLASS } from './cellClassNames';

interface Props {
  onDuplicate: () => void;
  onDelete: () => void;
  /** The frame's hover class, so these reveal with the rest of the cell's controls. */
  className?: string;
  inline?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NotebookCellActions({ onDuplicate, onDelete, className, inline = false, onOpenChange }: Props) {
  const styles = useStyles2(getStyles);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  useEffect(() => {
    onOpenChange?.(isMenuOpen);
    return () => onOpenChange?.(false);
  }, [isMenuOpen, onOpenChange]);

  return (
    <div
      className={cx(
        !inline && styles.actions,
        inline && styles.inlineActions,
        className,
        isMenuOpen && [styles.revealed, NOTEBOOK_CELL_CONTROLS_PINNED_CLASS]
      )}
    >
      <Dropdown
        placement="bottom-end"
        onVisibleChange={setIsMenuOpen}
        overlay={
          <Menu ariaLabel={t('notebook.cell.block-actions', 'Block actions')}>
            <Menu.Item icon="copy" label={t('notebook.cell.duplicate', 'Duplicate block')} onClick={onDuplicate} />
            <Menu.Item icon="trash-alt" label={t('notebook.cell.delete', 'Delete block')} onClick={onDelete} />
          </Menu>
        }
      >
        <IconButton
          name="ellipsis-v"
          size="sm"
          aria-haspopup="menu"
          tooltip={t('notebook.cell.block-actions', 'Block actions')}
        />
      </Dropdown>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  inlineActions: css({
    display: 'flex',
    alignItems: 'center',
  }),
  actions: css({
    position: 'absolute',
    top: theme.spacing(2),
    right: theme.spacing(0.5),
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    opacity: 0,
    pointerEvents: 'none',
    '@media (hover: none)': {
      opacity: 1,
      pointerEvents: 'auto',
    },
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity'),
    },
  }),
  revealed: css({
    opacity: 1,
    pointerEvents: 'auto',
  }),
});
