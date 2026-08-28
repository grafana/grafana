import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Dropdown, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { NotebookBlockTypeMenu, type NotebookBlockType } from './NotebookBlockTypeMenu';

// navigator.userAgent doesn't change during a tab's lifetime, so this only needs computing once.
const isMac = navigator.userAgent.includes('Mac');

interface Props {
  /** This cell's own position. Plain click inserts at index + 1 (below); alt/option-click at index (above). */
  index: number;
  onAdd?: (type: NotebookBlockType, index: number) => void;
  /** Stable class name the parent cell frame's hover rule targets — see NotebookCellFrame. */
  className?: string;
}

// Dropdown clones its `children` and overwrites both its onClick and its ref with its own open/close
// handling, so neither can live directly on the trigger — hence the capture handler below (reading the
// modifier at click-time) and this marker attribute (identifying the trigger without a ref). The overlay
// it opens also renders into a Portal, whose clicks bubble up through this same React subtree, so the
// marker also keeps a menu-item pick from re-triggering the capture handler and clobbering the index.
const TRIGGER_ATTRIBUTE = 'data-notebook-add-trigger';

/**
 * The per-cell "add block" affordance, shown next to the drag handle in edit mode: a plain click inserts
 * below this cell, an alt/option-click inserts above it.
 */
export function NotebookCellAddButton({ index, onAdd, className }: Props) {
  const styles = useStyles2(getStyles);
  const [pendingIndex, setPendingIndex] = useState(index + 1);
  // Kept revealed while the menu is open, since opening it can move the pointer/focus outside the
  // frame (into the Portal), which would otherwise fade this back out mid-interaction.
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleWrapperClick = (event: React.MouseEvent) => {
    if (event.target instanceof Element && event.target.closest(`[${TRIGGER_ATTRIBUTE}]`)) {
      setPendingIndex(event.altKey ? index : index + 1);
    }
  };

  return (
    <div className={cx(styles.wrapper, className, isMenuOpen && styles.revealed)} onClickCapture={handleWrapperClick}>
      {/* Tooltip wraps the icon, not the button, so Dropdown's clone target is the real button — see
          TRIGGER_ATTRIBUTE above. */}
      <Dropdown
        overlay={<NotebookBlockTypeMenu onPick={(type) => onAdd?.(type, pendingIndex)} />}
        placement="bottom-start"
        onVisibleChange={setIsMenuOpen}
      >
        <button
          {...{ [TRIGGER_ATTRIBUTE]: true }}
          type="button"
          aria-label={t('notebook.add-block.label', 'Add block')}
          className={styles.button}
        >
          <Tooltip content={<AddButtonTooltipContent />} placement="left">
            <Icon name="plus" size="md" />
          </Tooltip>
        </button>
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
  // Carries the opacity toggle itself: the frame's reveal rule targets this element directly (it's
  // the direct child bearing NOTEBOOK_CELL_AFFORDANCES_CLASS), so the button inside just inherits it.
  wrapper: css({
    position: 'absolute',
    // Sits immediately right of the drag handle's own spacing(3)-wide box, inside the same gutter.
    left: theme.spacing(3.5),
    // Matches the drag handle's top offset (NotebookCellFrame's handle) so the two stay aligned.
    top: theme.spacing(4),
    width: theme.spacing(3),
    height: theme.spacing(3),
    opacity: 0,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity'),
    },
  }),
  revealed: css({
    opacity: 1,
  }),
  button: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    border: 'none',
    padding: 0,
    background: 'none',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    '&:hover': {
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.action.hover,
    },
    '&:focus-visible': getFocusStyles(theme),
  }),
});
