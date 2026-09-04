import { css, cx } from '@emotion/css';
import { useEffect, useId, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Dropdown, IconButton, useStyles2 } from '@grafana/ui';

import { NotebookBlockTypeMenu, type NotebookBlockType } from './NotebookBlockTypeMenu';

const isMac = navigator.userAgent.includes('Mac');

interface Props {
  /** This cell's own position. Plain click inserts at index + 1 (below); alt/option-click at index (above). */
  index: number;
  onAdd?: (type: NotebookBlockType, index: number) => void;
  className?: string;
}

/**
 * The per-cell "add block" affordance, shown next to the drag handle in edit mode: a plain click inserts
 * below this cell, an alt/option-click inserts above it.
 */
export function NotebookCellAddButton({ index, onAdd, className }: Props) {
  const styles = useStyles2(getStyles);
  const [pendingIndex, setPendingIndex] = useState(index + 1);
  const labelId = useId();
  // Kept revealed while the menu is open: opening it moves focus into the menu's own Portal (see
  // Dropdown's FloatingFocusManager), which lives outside this cell's frame — so the frame's own
  // :hover/:focus-within reveal rule stops matching and would otherwise fade this back out mid-interaction.
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Keyboard activation (Enter/Space on the trigger) never fires mouseUp, so without this, a cell
  // that moved — something inserted, deleted, or reordered above it — since mount or since its last
  // mouse interaction would keep offering its stale former position instead of its current one.
  useEffect(() => {
    setPendingIndex(index + 1);
  }, [index]);

  const onMouseUp = (event: React.MouseEvent) => {
    setPendingIndex(event.altKey ? index : index + 1);
  };

  return (
    <div className={cx(styles.wrapper, className, isMenuOpen && styles.revealed)}>
      <span id={labelId} className="sr-only">
        {t('notebook.add-block.label', 'Add block')}
      </span>
      <Dropdown
        overlay={<NotebookBlockTypeMenu onPick={(type) => onAdd?.(type, pendingIndex)} />}
        placement="bottom-start"
        onVisibleChange={setIsMenuOpen}
      >
        <IconButton
          name="plus"
          aria-labelledby={labelId}
          tooltip={<AddButtonTooltipContent />}
          tooltipPlacement="left"
          onMouseUp={onMouseUp}
        />
      </Dropdown>
    </div>
  );
}

function AddButtonTooltipContent() {
  return (
    <div>
      <div>
        <Trans i18nKey="notebook.cell.add-button.tooltip-below">
          <strong>Click</strong> to add below
        </Trans>
      </div>
      <div>
        {isMac ? (
          <Trans i18nKey="notebook.cell.add-button.tooltip-above-mac">
            <strong>Option-click</strong> to add above
          </Trans>
        ) : (
          <Trans i18nKey="notebook.cell.add-button.tooltip-above-other">
            <strong>Alt-click</strong> to add above
          </Trans>
        )}
      </div>
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
