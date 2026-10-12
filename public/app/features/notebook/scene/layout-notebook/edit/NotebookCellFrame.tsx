import { css, cx } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, Icon, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { type NotebookCellItem } from '../NotebookCellItem';
import { NotebookCellRenderer } from '../NotebookCellRenderer';
import { resolveScrollAlign } from '../cells/focusExtension';

import { type NotebookBlockType } from './NotebookBlockTypeMenu';
import { NotebookCellActions } from './NotebookCellActions';
import { NotebookCellAddButton } from './NotebookCellAddButton';
import {
  NOTEBOOK_CELL_CONTROLS_CLASS,
  NOTEBOOK_CELL_CONTROLS_PINNED_CLASS,
  NOTEBOOK_CELL_FRAME_CLASS,
} from './cellClassNames';

/** Hand-written for the same reason as the class above. */
export const NOTEBOOK_CELL_CONTENT_CLASS = 'notebook-cell-content';

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
   * 0-based — dnd derives every drop boundary from it. Doubles as the add button's insertion index,
   * since that button inserts directly above this cell.
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
  /** Forwarded to this cell's add button, which passes this cell's own `index` — an insert above it. */
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
 * One notebook cell plus its edit-mode controls: a drag handle and an add-cell button in the left
 * gutter, both revealed by hovering (or focusing into) the cell. The cell renderer itself stays a pure
 * content dispatcher, so everything about editing lives here.
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
  const [menuOpen, setMenuOpen] = useState(false);
  const { collapsed, body, content, elementName } = cell.useState();
  // Markdown/Code hand a focus grant to their own editor's caret (via useFocusExtension) and detect
  // an ArrowUp/Down boundary themselves. A Panel or Collapsed cell has no caret to do either with, so
  // the frame itself stands in for both below.
  const isEditorCell = !collapsed && !body && (content?.kind === 'Markdown' || content?.kind === 'Code');

  const frameLabel = collapsed
    ? t('notebook.cell.frame.aria-label-collapsed', 'Collapsed block: {{name}}', { name: elementName })
    : t('notebook.cell.frame.aria-label-panel', 'Visualization block: {{name}}', { name: elementName });
  const dragHandleLabel =
    onDuplicate && onDelete
      ? t('notebook.cell.block-actions', 'Block actions')
      : t('notebook.cell.drag-handle', 'Drag to reorder');

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
    <Draggable
      draggableId={cell.state.key!}
      index={index}
      isDragDisabled={!isEditing}
      disableInteractiveElementBlocking
    >
      {(dragProvided, dragSnapshot) => {
        const handle = (
          <button
            type="button"
            {...dragProvided.dragHandleProps}
            aria-label={dragHandleLabel}
            title={t(
              'notebook.cell.handle-help',
              'Click for block actions; drag to move. Press Space to reorder with the keyboard.'
            )}
            className={cx(
              styles.handle,
              NOTEBOOK_CELL_CONTROLS_CLASS,
              menuOpen && [styles.revealed, NOTEBOOK_CELL_CONTROLS_PINNED_CLASS]
            )}
          >
            <Icon name="draggabledots" size="md" />
          </button>
        );
        return (
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
              NOTEBOOK_CELL_FRAME_CLASS,
              styles.frame,
              isEditing && styles.frameEditing,
              !isEditorCell && styles.frameFocusable,
              dragSnapshot.isDragging && styles.dragging,
              (dragSnapshot.isDragging || isDragActive) && styles.controlsHidden,
              dropIndicator === 'top' && styles.dropLineTop,
              dropIndicator === 'bottom' && styles.dropLineBottom
            )}
          >
            {isEditing &&
              (onDuplicate && onDelete ? (
                <Dropdown
                  overlay={<NotebookCellActions onDuplicate={onDuplicate} onDelete={onDelete} />}
                  placement="bottom-start"
                  onVisibleChange={setMenuOpen}
                >
                  {handle}
                </Dropdown>
              ) : (
                handle
              ))}
            {isEditing && (
              <NotebookCellAddButton index={index} onAdd={onAdd} className={NOTEBOOK_CELL_CONTROLS_CLASS} />
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
          </div>
        );
      }}
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
    // Wide enough for the drag handle and the add-cell button side by side — see the same numbers in
    // NotebookCellAddButton.tsx, and dragging/dropLine below, which all anchor off this same gutter.
    paddingLeft: theme.spacing(7),
    marginLeft: theme.spacing(-7),

    [theme.breakpoints.up('md')]: {
      paddingLeft: theme.spacing(10),
      marginLeft: theme.spacing(-10),
    },
    [`&:hover > .${NOTEBOOK_CELL_CONTROLS_CLASS}, &:focus-within > .${NOTEBOOK_CELL_CONTROLS_CLASS}`]: {
      opacity: 1,
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
    border: 0,
    padding: 0,
    background: 'transparent',
    position: 'absolute',
    left: theme.spacing(3.5),
    width: theme.spacing(3),
    height: theme.spacing(3),
    top: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    cursor: 'grab',
    opacity: 0,
    '@media (hover: none)': { opacity: 1 },
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
  controlsHidden: css({
    [`& .${NOTEBOOK_CELL_CONTROLS_CLASS}`]: {
      visibility: 'hidden',
    },
  }),
  revealed: css({ opacity: 1 }),
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
