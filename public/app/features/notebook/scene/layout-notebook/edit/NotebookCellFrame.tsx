import { css, cx } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import { type KeyboardEvent, useEffect, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { type NotebookCellItem } from '../NotebookCellItem';
import { NotebookCellRenderer } from '../NotebookCellRenderer';
import { resolveScrollAlign } from '../cells/focusExtension';

import { NotebookAddBlockDivider } from './NotebookAddBlockDivider';
import { type NotebookBlockType } from './NotebookBlockTypeMenu';
import { NotebookCellActions } from './NotebookCellActions';

/**
 * Stable class name the frame's hover rule targets. Emotion class names are generated, so revealing a
 * child's style from a parent needs a hand-written class plus a descendant selector — the same
 * convention as `dashboard-canvas-controls` in the dashboard layouts.
 */
const NOTEBOOK_CELL_AFFORDANCES_CLASS = 'notebook-cell-affordances';

const NOTEBOOK_CELL_CONTENT_CLASS = 'notebook-cell-content';

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
  scrollAlign?: ScrollLogicalPosition;
  /** True while any cell in the notebook is being dragged, not only this one. */
  isDragActive?: boolean;
  dropIndicator?: NotebookCellDropIndicator;
  /** Forwarded to this cell's divider, already offset to `index + 1`. See NotebookAddBlockDivider. */
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
  /**
   * ArrowUp/ArrowDown once there's nowhere further to go inside this cell — a Markdown/Code cell
   * decides that itself (see their own boundary-aware keymaps) and calls this the same way a
   * Panel/Collapsed cell does from the frame's own onKeyDown below, since neither has a caret of its
   * own to ask.
   */
  onNavigate?: (direction: 'up' | 'down') => void;
}

/**
 * One notebook cell plus its edit-mode affordances: a drag handle in the left gutter and the insertion
 * point below it, both revealed by hovering (or focusing into) the cell. The cell renderer itself stays
 * a pure content dispatcher — everything editing-related lives here.
 */
export function NotebookCellFrame({
  cell,
  index,
  isEditing,
  autoFocus,
  focusRequestId,
  caretOffset,
  scrollAlign,
  isDragActive,
  dropIndicator,
  onAdd,
  onDuplicate,
  onDelete,
  onAdvance,
  onFocusRequest,
  onNavigate,
}: Props) {
  const styles = useStyles2(getStyles);
  const { collapsed, body, content, elementName } = cell.useState();
  // Markdown/Code hand a focus grant to their own editor's caret (via useFocusExtension) and detect
  // an ArrowUp/Down boundary themselves. A Panel or Collapsed cell has no caret to do either with, so
  // the frame itself stands in for both below.
  const isEditorCell = !collapsed && !body && (content?.kind === 'Markdown' || content?.kind === 'Code');

  const frameLabel = collapsed
    ? t('notebook.cell.frame.aria-label-collapsed', 'Collapsed block: {{name}}', { name: elementName })
    : t('notebook.cell.frame.aria-label-panel', 'Visualization block: {{name}}', { name: elementName });

  const frameRef = useRef<HTMLDivElement>(null);
  const pendingAutoFocus = useRef(Boolean(autoFocus && isEditing && !isEditorCell));
  const previousFocusRequestId = useRef(focusRequestId);

  const focusFrame = () => {
    const node = frameRef.current;
    if (!node) {
      return;
    }
    node.focus({ preventScroll: true });
    node.scrollIntoView({ block: resolveScrollAlign(node, scrollAlign), inline: 'nearest' });
  };

  useEffect(() => {
    if (isEditorCell || !isEditing) {
      return;
    }
    if (pendingAutoFocus.current) {
      pendingAutoFocus.current = false;
      previousFocusRequestId.current = focusRequestId;
      focusFrame();
      return;
    }
    const isFreshRequest = focusRequestId !== undefined && focusRequestId !== previousFocusRequestId.current;
    previousFocusRequestId.current = focusRequestId;
    if (isFreshRequest) {
      focusFrame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focusFrame is a fresh closure every render over the same ref/callback shape; only the nonce/mode inputs should re-run this
  }, [focusRequestId, isEditing, isEditorCell]);

  const onFrameKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Only when the bare frame itself is focused — never for a key bubbling up from something
    // interactive inside it (a panel's own legend, menu, etc.), which owns its own arrow keys.
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onNavigate?.('up');
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      onNavigate?.('down');
    }
  };

  return (
    <Draggable draggableId={cell.state.key!} index={index} isDragDisabled={!isEditing}>
      {(dragProvided, dragSnapshot) => (
        <div
          ref={(node) => {
            dragProvided.innerRef(node);
            frameRef.current = node;
          }}
          {...dragProvided.draggableProps}
          tabIndex={isEditing && !isEditorCell ? 0 : undefined}
          onKeyDown={!isEditorCell ? onFrameKeyDown : undefined}
          role={!isEditorCell ? 'group' : undefined}
          aria-label={!isEditorCell ? frameLabel : undefined}
          className={cx(
            styles.frame,
            isEditing && styles.frameEditing,
            !isEditorCell && styles.frameFocusable,
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

          <div className={NOTEBOOK_CELL_CONTENT_CLASS}>
            <NotebookCellRenderer
              cell={cell}
              isEditing={Boolean(isEditing)}
              autoFocus={autoFocus}
              focusRequestId={focusRequestId}
              caretOffset={caretOffset}
              scrollAlign={scrollAlign}
              onAdvance={onAdvance}
              onFocusRequest={onFocusRequest}
              onNavigate={onNavigate}
            />
          </div>

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
    scrollMarginTop: theme.spacing(14),
    scrollMarginBottom: theme.spacing(4),
  }),
  frameEditing: css({
    paddingLeft: theme.spacing(4),
    marginLeft: theme.spacing(-4),
    [theme.breakpoints.up('md')]: {
      paddingLeft: theme.spacing(7),
      marginLeft: theme.spacing(-7),
    },
    // The reveal, and only the reveal: the hidden state stays in each affordance's own single-class
    // rule. A rule here setting opacity: 0 would out-specify the divider's `revealed` class and make
    // the divider vanish under its own open menu. `>` keeps it to this frame's own affordances.
    [`&:hover > .${NOTEBOOK_CELL_AFFORDANCES_CLASS}, &:focus-within > .${NOTEBOOK_CELL_AFFORDANCES_CLASS}`]: {
      opacity: 1,
      // Paired with the actions bar's own `pointer-events: none`: that bar sits outside this frame's box
      // and above the previous cell's divider, so while hidden it must not answer the hit test there.
      // Reaching it from inside the frame still works — the frame is already hovered, so the bar is
      // already interactive by the time the pointer arrives on it.
      pointerEvents: 'auto',
    },
  }),
  frameFocusable: css({
    '&:focus': {
      outline: 'none',
    },
    [`&:focus > .${NOTEBOOK_CELL_CONTENT_CLASS}`]: {
      outline: `1px dashed ${theme.colors.accent.main}`,
      outlineOffset: 0,
      borderRadius: theme.shape.radius.default,
    },
  }),
  handle: css({
    position: 'absolute',
    // frameEditing's padding-left now reserves exactly this gutter, so the handle sits flush at the
    // padding box's own edge — no more reaching outside it with a negative offset.
    left: 0,
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
    opacity: 0.9,
    '&::before': {
      content: '""',
      position: 'absolute',
      zIndex: -1,
      pointerEvents: 'none',
      top: 0,
      right: 0,
      bottom: 0,
      left: theme.spacing(4),
      [theme.breakpoints.up('md')]: {
        left: theme.spacing(7),
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
    bottom: '100%',
    // Starts at the frame's own left edge, covering the gutter/handle column above it too — not just
    // the span the actions bar itself occupies. Without that, the top-left corner of the widened hit-box
    // is a dead zone: nothing there answers the hit test, so hovering it doesn't reveal anything, and the
    // pointer has to drift right past the gutter before the actions bar appears.
    left: 0,
    width: theme.spacing(12),
    [theme.breakpoints.up('md')]: {
      width: theme.spacing(15),
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
    // edge rather than bleeding into the wider hit-box reserved for the drag handle.
    left: theme.spacing(4),
    [theme.breakpoints.up('md')]: {
      left: theme.spacing(7),
    },
    right: 0,
    height: 2,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.primary.border,
    pointerEvents: 'none' as const,
  };
}
