import { css, cx } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { type NotebookCellItem } from '../NotebookCellItem';
import { NotebookCellRenderer } from '../NotebookCellRenderer';

import { type NotebookBlockType } from './NotebookBlockTypeMenu';
import { NotebookCellActions } from './NotebookCellActions';
import { NotebookCellAddButton } from './NotebookCellAddButton';

/**
 * Stable class name the frame's hover rule targets. Emotion class names are generated, so revealing a
 * child's style from a parent needs a hand-written class plus a descendant selector — the same
 * convention as `dashboard-canvas-controls` in the dashboard layouts.
 */
const NOTEBOOK_CELL_AFFORDANCES_CLASS = 'notebook-cell-affordances';

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
   * 0-based — dnd derives every drop boundary from it. Also the base for the add button's insertion
   * index: `index + 1` (below, on a plain click) or `index` (above, on alt/option-click).
   */
  index: number;
  isEditing?: boolean;
  /**
   * Set on the cell the reader just inserted. The layout owns it rather than the cell: only one cell
   * takes the caret, and which one is a fact about the list, not about any cell in it.
   */
  autoFocus?: boolean;
  /**
   * A nonce, defined exactly when `autoFocus` is true and bumped on every fresh focus request for this
   * cell (see NotebookLayoutManagerRenderer's `focusRequest` state) — passed through to MarkdownCell's
   * useFocusExtension, which explains why a nonce and not a boolean is needed here.
   */
  focusRequestId?: number;
  /**
   * Where the caret should land on that focus grant, instead of the document's own end — see
   * MarkdownCell's own `caretOffset` doc comment. Only meaningful together with `focusRequestId`.
   */
  caretOffset?: number;
  /** True while any cell in the notebook is being dragged, not only this one. */
  isDragActive?: boolean;
  dropIndicator?: NotebookCellDropIndicator;
  /** Forwarded to this cell's add button, which decides whether to offset it to `index + 1`. */
  onAdd?: (type: NotebookBlockType, index: number) => void;
  /**
   * Supplied by the layout, which owns the cells list. Optional so the frame stays renderable on its
   * own; the actions bar is left out entirely when they are absent, rather than shown doing nothing.
   */
  onDuplicate?: () => void;
  onDelete?: () => void;
  /**
   * Enter's "split into a new block" gesture — a genuinely new cell is inserted right after this one
   * and takes the caret, wherever in the document this cell happens to be. `remainder` is whatever
   * text sat after the caret (already removed from this cell), for the caller to seed into the new
   * one. A `marker` argument (`'- '`, or the next number) means Enter was pressed on a non-empty list
   * item — the caller seeds it ahead of `remainder` so the list continues there.
   */
  onAdvance?: (remainder: string, marker?: string) => void;
  /**
   * Re-requests the caret for this same cell after something else moved it away without meaning to —
   * currently just the "/" menu any empty markdown cell offers.
   */
  onFocusRequest?: () => void;
}

/**
 * One notebook cell plus its edit-mode affordances: a drag handle and an add-cell button in the left
 * gutter, both revealed by hovering (or focusing into) the cell. The cell renderer itself stays a pure
 * content dispatcher — everything editing-related lives here.
 */
export function NotebookCellFrame({
  cell,
  index,
  isEditing,
  autoFocus,
  focusRequestId,
  caretOffset,
  isDragActive,
  dropIndicator,
  onAdd,
  onDuplicate,
  onDelete,
  onAdvance,
  onFocusRequest,
}: Props) {
  const styles = useStyles2(getStyles);

  return (
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
              {...dragProvided.dragHandleProps}
              aria-label={t('notebook.cell.drag-handle', 'Drag to reorder')}
              className={cx(styles.handle, NOTEBOOK_CELL_AFFORDANCES_CLASS)}
            >
              <Tooltip content={t('notebook.cell.drag-handle', 'Drag to reorder')} placement="left">
                <Icon name="draggabledots" size="md" />
              </Tooltip>
            </div>
          )}

          {isEditing && (
            <NotebookCellAddButton index={index} onAdd={onAdd} className={NOTEBOOK_CELL_AFFORDANCES_CLASS} />
          )}

          {isEditing && onDuplicate && onDelete && (
            <>
              <div
                className={cx(
                  styles.actionsHoverBridge,
                  (dragSnapshot.isDragging || isDragActive) && styles.actionsHoverBridgeHidden
                )}
              />
              <NotebookCellActions
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                className={NOTEBOOK_CELL_AFFORDANCES_CLASS}
              />
            </>
          )}

          <NotebookCellRenderer
            cell={cell}
            isEditing={Boolean(isEditing)}
            autoFocus={autoFocus}
            focusRequestId={focusRequestId}
            caretOffset={caretOffset}
            onAdvance={onAdvance}
            onFocusRequest={onFocusRequest}
          />
        </div>
      )}
    </Draggable>
  );
}

/**
 * Which edge of cell `index` the drop line goes on, for the drag currently in flight.
 
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
    position: 'relative',
  }),
  frameEditing: css({
    paddingLeft: theme.spacing(7),
    marginLeft: theme.spacing(-7),
    paddingTop: theme.spacing(3),
    [theme.breakpoints.up('md')]: {
      paddingLeft: theme.spacing(10),
      marginLeft: theme.spacing(-10),
    },
    [`&:hover > .${NOTEBOOK_CELL_AFFORDANCES_CLASS}, &:focus-within > .${NOTEBOOK_CELL_AFFORDANCES_CLASS}`]: {
      opacity: 1,
      pointerEvents: 'auto',
    },
  }),
  handle: css({
    position: 'absolute',
    left: 0,
    width: theme.spacing(3),
    height: theme.spacing(3),
    top: theme.spacing(4),
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
    opacity: 0.9,
    '&::before': {
      content: '""',
      position: 'absolute',
      zIndex: -1,
      pointerEvents: 'none',
      top: 0,
      right: 0,
      bottom: 0,
      left: theme.spacing(7),
      [theme.breakpoints.up('md')]: {
        left: theme.spacing(10),
      },
      backgroundColor: theme.colors.background.primary,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.flags.visualDesignRefresh ? theme.shadows.z2 : theme.shadows.z3,
    },
  }),
  affordancesHidden: css({
    [`& .${NOTEBOOK_CELL_AFFORDANCES_CLASS}`]: {
      visibility: 'hidden',
    },
  }),
  actionsHoverBridge: css({
    position: 'absolute',
    // Sits inside this frame's own reserved top padding (frameEditing's paddingTop), never above the
    // frame's own top edge — that edge is the previous cell's box, and reaching past it here is
    // exactly what used to let a short previous cell's own content get hovered as if it were this
    // bridge instead.
    top: 0,
    // Starts at the frame's own left edge, covering the gutter/handle column above it too — not just
    // the span the actions bar itself occupies. Without that, the top-left corner of the widened hit-box
    // is a dead zone: nothing there answers the hit test, so hovering it doesn't reveal anything, and the
    // pointer has to drift right past the gutter before the actions bar appears.
    left: 0,
    width: theme.spacing(15),
    [theme.breakpoints.up('md')]: {
      width: theme.spacing(18),
    },
    height: theme.spacing(4),
    pointerEvents: 'auto',
  }),
  actionsHoverBridgeHidden: css({
    pointerEvents: 'none',
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
    // Matches frameEditing's gutter padding-left, so the line still starts at the cell's own content
    // edge rather than bleeding into the wider hit-box reserved for the drag handle and add button.
    left: theme.spacing(7),
    [theme.breakpoints.up('md')]: {
      left: theme.spacing(10),
    },
    right: 0,
    height: 2,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.primary.border,
    pointerEvents: 'none' as const,
  };
}
