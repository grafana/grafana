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
  // Kept revealed while the menu is open: opening it moves focus into the menu's own Portal (see
  // Dropdown's FloatingFocusManager), which lives outside this cell's frame — so the frame's own
  // :hover/:focus-within reveal rule stops matching and would otherwise fade this back out mid-interaction.
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className={cx(styles.wrapper, className, isMenuOpen && styles.revealed)}>
      <Dropdown
        overlay={<NotebookBlockTypeMenu onPick={(type) => onAdd?.(type, index + 1)} />}
        placement="bottom-start"
        onVisibleChange={setIsMenuOpen}
      >
        <IconButton name="plus" tooltip={t('notebook.add-block.label', 'Add block')} tooltipPlacement="left" />
      </Dropdown>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'absolute',
    // Sits immediately right of the drag handle's own spacing(3)-wide box, inside the same gutter.
    left: theme.spacing(3.5),
    // Matches the drag handle's top offset (NotebookCellFrame's handle) so the two stay aligned.
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
