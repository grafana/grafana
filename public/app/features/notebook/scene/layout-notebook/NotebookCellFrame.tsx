import { css, cx } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { NotebookAddBlockDivider } from './NotebookAddBlockDivider';
import { type NotebookBlockType } from './NotebookBlockTypeMenu';
import { type NotebookCellItem } from './NotebookCellItem';
import { NotebookCellRenderer } from './NotebookCellRenderer';

/**
 * Stable class name the frame's hover rule targets. Emotion class names are generated, so revealing a
 * child's style from a parent needs a hand-written class plus a descendant selector — the same
 * convention as `dashboard-canvas-controls` in the dashboard layouts.
 */
export const NOTEBOOK_CELL_AFFORDANCES_CLASS = 'notebook-cell-affordances';

/** Which edge of a cell the drop line is drawn on while a drag is in flight. */
export type NotebookCellDropIndicator = 'top' | 'bottom';

export interface NotebookDragState {
  source: number;
  /** null while the pointer is outside the droppable. */
  destination: number | null;
}

interface Props {
  cell: NotebookCellItem;
  /**
   * The cell's position in `cells`. This doubles as the Draggable index, so it must stay dense and
   * 0-based — dnd derives every drop boundary from it. The insertion index handed to the divider is
   * `index + 1`, because the divider belongs to the cell above it.
   */
  index: number;
  isEditing?: boolean;
  /** True while any cell in the notebook is being dragged, not only this one. */
  isDragActive?: boolean;
  dropIndicator?: NotebookCellDropIndicator;
  /** Forwarded to the divider; still unwired in production. See NotebookAddBlockDivider. */
  onAdd?: (type: NotebookBlockType, index: number) => void;
}

/**
 * One notebook cell plus its edit-mode affordances: a drag handle in the left gutter and the insertion
 * point below it, both revealed by hovering (or focusing into) the cell. The cell renderer itself stays
 * a pure content dispatcher — everything editing-related lives here.
 */
export function NotebookCellFrame({ cell, index, isEditing, isDragActive, dropIndicator, onAdd }: Props) {
  const styles = useStyles2(getStyles);

  return (
    // Mounted in both modes and disabled rather than unmounted in view mode: branching the tree on
    // isEditing would remount every cell on toggle, which means remounting the code editor in a code
    // cell and re-activating every VizPanel.
    <Draggable draggableId={cell.state.key!} index={index} isDragDisabled={!isEditing}>
      {(dragProvided, dragSnapshot) => (
        <div
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          className={cx(
            styles.frame,
            isEditing && styles.frameEditing,
            dragSnapshot.isDragging && styles.dragging,
            (dragSnapshot.isDragging || isDragActive) && styles.affordancesHidden,
            dropIndicator === 'top' && styles.dropLineTop,
            dropIndicator === 'bottom' && styles.dropLineBottom
          )}
        >
          {isEditing && (
            <div
              // dragHandleProps brings role="button", tabIndex={0} and aria-describedby (dnd's own
              // keyboard instructions) but no accessible name, so the label is mandatory, not decorative.
              {...dragProvided.dragHandleProps}
              aria-label={t('notebook.cell.drag-handle', 'Drag to reorder')}
              className={cx(styles.handle, NOTEBOOK_CELL_AFFORDANCES_CLASS)}
            >
              <Tooltip content={t('notebook.cell.drag-handle', 'Drag to reorder')} placement="left">
                <Icon name="draggabledots" size="md" />
              </Tooltip>
            </div>
          )}

          <NotebookCellRenderer cell={cell} />

          {/* index + 1: this divider inserts *after* the cell it belongs to. */}
          {isEditing && (
            <NotebookAddBlockDivider index={index + 1} onAdd={onAdd} className={NOTEBOOK_CELL_AFFORDANCES_CLASS} />
          )}
        </div>
      )}
    </Draggable>
  );
}

/**
 * Which edge of cell `index` the drop line goes on, for the drag currently in flight.
 *
 * Dragging down, the cells between source and destination shift up, so the gap opens below the cell
 * originally at `destination`; dragging up they shift down and it opens above it. Derived rather than
 * measured, so it is correct for a one-line markdown cell and a 300px panel alike — and unlike
 * highlighting a divider, it can mark a drop at the very top, where no cell owns a divider.
 */
export function getCellDropIndicator(
  drag: NotebookDragState | null,
  index: number
): NotebookCellDropIndicator | undefined {
  if (!drag || drag.destination === null || drag.destination === drag.source || drag.destination !== index) {
    return undefined;
  }

  return drag.destination > drag.source ? 'bottom' : 'top';
}

const getStyles = (theme: GrafanaTheme2) => ({
  frame: css({
    // Anchors both the drag handle and the drop line. Neither is in the flow, so revealing them never
    // moves the cell.
    position: 'relative',
  }),
  frameEditing: css({
    // The reveal, and only the reveal: the hidden state stays in each affordance's own single-class
    // rule. A rule here setting opacity: 0 would out-specify the divider's `revealed` class and make
    // the divider vanish under its own open menu. `>` keeps it to this frame's own affordances.
    [`&:hover > .${NOTEBOOK_CELL_AFFORDANCES_CLASS}, &:focus-within > .${NOTEBOOK_CELL_AFFORDANCES_CLASS}`]: {
      opacity: 1,
    },
  }),
  handle: css({
    position: 'absolute',
    // Into the document's left padding (see NotebookLayoutManager), so the content box sits at the
    // same x hovered or not, and in view mode or edit mode. -4 rather than -3 leaves a spacing(1) gap
    // between the handle and the cell it belongs to, instead of the handle sitting flush against it.
    left: theme.spacing(-4),
    width: theme.spacing(3),
    height: theme.spacing(3),
    // Top-aligned rather than centred: spacing(1) lines up with the first line of a narrative cell and
    // with a panel's chrome title, whatever the cell's height. Centring would put the handle 150px
    // down a panel cell.
    top: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    cursor: 'grab',
    opacity: 0,
    '&:hover': {
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.action.hover,
    },
    '&:active': {
      cursor: 'grabbing',
    },
    // dragHandleProps makes this a tab stop, and a tab stop at opacity 0 is a focus trap for sighted
    // keyboard users. The frame's :focus-within reveals it; this makes the ring visible.
    '&:focus-visible': getFocusStyles(theme),
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity'),
    },
  }),
  dragging: css({
    // dnd translates the real element rather than a clone. renderClone is deliberately unused: it
    // would mount a second copy of the cell, and for a panel cell that is a second VizPanel with its
    // own query runner.
    opacity: 0.9,
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
  }),
  affordancesHidden: css({
    // visibility, not opacity: dnd only sets pointer-events: none on drag handles, so hovering another
    // cell mid-drag still fires :hover and would pop its divider up under the dragged element. A
    // different property sidesteps the specificity question rather than fighting it.
    [`& .${NOTEBOOK_CELL_AFFORDANCES_CLASS}`]: {
      visibility: 'hidden',
    },
  }),
  dropLineTop: css({
    '&::before': dropLine(theme, 'top'),
  }),
  dropLineBottom: css({
    '&::after': dropLine(theme, 'bottom'),
  }),
});

// A bar on the frame's edge marking where the cell would land. Absolute, so it adds no height mid-drag.
function dropLine(theme: GrafanaTheme2, edge: NotebookCellDropIndicator) {
  return {
    content: '""',
    position: 'absolute' as const,
    [edge]: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.primary.border,
    pointerEvents: 'none' as const,
  };
}
