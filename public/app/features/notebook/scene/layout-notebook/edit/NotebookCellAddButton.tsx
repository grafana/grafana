import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, IconButton, useStyles2 } from '@grafana/ui';

import { NotebookBlockTypeMenu, type NotebookBlockType } from './NotebookBlockTypeMenu';

interface Props {
  /** This cell's own position; the button always inserts directly below it, at index + 1. */
  index: number;
  onAdd?: (type: NotebookBlockType, index: number) => void;
  className?: string;
}

/**
 * The per-cell "add block" affordance, shown next to the drag handle in edit mode: inserts a new
 * block directly below this cell.
 */
export function NotebookCellAddButton({ index, onAdd, className }: Props) {
  const styles = useStyles2(getStyles);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className={cx(styles.wrapper, className, isMenuOpen && styles.revealed)}>
      <Dropdown
        overlay={<NotebookBlockTypeMenu onPick={(type) => onAdd?.(type, index + 1)} />}
        placement="bottom-start"
        onVisibleChange={setIsMenuOpen}
      >
        <IconButton name="plus" tooltip={t('notebook.add-block.label', 'Click to add below')} tooltipPlacement="left" />
      </Dropdown>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'absolute',
    left: theme.spacing(3.5),
    top: theme.spacing(4),
    width: theme.spacing(3),
    height: theme.spacing(3),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity'),
    },
  }),
  revealed: css({
    opacity: 1,
  }),
});
