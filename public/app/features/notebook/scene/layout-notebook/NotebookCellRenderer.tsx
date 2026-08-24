import { css } from '@emotion/css';
import { offset, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { Suspense, useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { floatingUtils, Portal, useStyles2 } from '@grafana/ui';
import { type CellContentKind } from 'app/features/notebook/types';

import { type NotebookCellItem } from './NotebookCellItem';
import { MarkdownCell } from './cells/MarkdownCell';
import { cellTypeRegistry } from './cells/cellTypeRegistry';
import { NotebookBlockTypeMenu, type NotebookBlockType } from './edit/NotebookBlockTypeMenu';

// A lone VizPanel fills its parent, so the parent needs a resolved height (not just
// min-height) or PanelChrome measures 0 and nothing shows.
const PANEL_HEIGHT = 300;

/**
 * The focus/editing props every level between NotebookCellFrame and a cell's actual renderer just
 * forwards, unread, to the next level down — kept as one shared shape rather than retyped at each of
 * NotebookCellRenderer, NarrativeCell, and SpecialMarkdownCell. See NotebookCellFrame's own doc
 * comments on `autoFocus`/`focusRequestId`/`onAdvance`/`onFocusRequest` for what each one means.
 */
interface NarrativeCellFocusProps {
  isEditing: boolean;
  autoFocus?: boolean;
  focusRequestId?: number;
  caretOffset?: number;
  onAdvance?: (remainder: string, marker?: string) => void;
  onFocusRequest?: () => void;
}

// A notebook cell is one of two things: a panel (a chart) or narrative content (a markdown or
// code block). This chooses the matching renderer, or shows a compact placeholder when the cell
// is collapsed.
export function NotebookCellRenderer({
  cell,
  isEditing,
  autoFocus,
  focusRequestId,
  caretOffset,
  onAdvance,
  onFocusRequest,
}: { cell: NotebookCellItem } & NarrativeCellFocusProps) {
  const { body: panel, content: narrative, collapsed, elementName } = cell.useState();

  if (collapsed) {
    return <CollapsedCell name={elementName} />;
  }

  if (panel) {
    return <PanelCell panel={panel} />;
  }

  if (narrative) {
    return (
      <NarrativeCell
        cell={cell}
        content={narrative}
        isEditing={isEditing}
        autoFocus={autoFocus}
        focusRequestId={focusRequestId}
        caretOffset={caretOffset}
        onAdvance={onAdvance}
        onFocusRequest={onFocusRequest}
      />
    );
  }

  return null;
}

// A chart cell: delegates to its VizPanel, which brings its own PanelChrome (title, menu, legend).
function PanelCell({ panel }: { panel: VizPanel }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.panel}>
      <panel.Component model={panel} />
    </div>
  );
}

// A narrative cell: markdown or code, rendered by the component registered for its content kind.
//
// Edits go back through the layout manager rather than straight onto this cell, because a cell
// cannot see the siblings that may reference the same element. They end up on cell state, which is
// where transformNotebookSceneToSaveModel reads content from — so an export (and, later, a save)
// serializes what the reader actually sees. Nothing is persisted to the API yet.
//
// onAdvance bypasses the generic cellTypeRegistry path — pushing placeholder text, the "/" block
// menu, or onSubmit into the shared registry contract would mean every other renderer (CodeCell
// included) has to explicitly opt out of behavior that only ever applies to markdown cells.
function NarrativeCell({
  cell,
  content,
  isEditing,
  autoFocus,
  focusRequestId,
  caretOffset,
  onAdvance,
  onFocusRequest,
}: { cell: NotebookCellItem; content: CellContentKind } & NarrativeCellFocusProps) {
  const styles = useStyles2(getStyles);

  if (content.kind === 'Markdown') {
    return (
      <div className={styles.content}>
        <SpecialMarkdownCell
          cell={cell}
          content={content}
          isEditing={isEditing}
          autoFocus={autoFocus}
          focusRequestId={focusRequestId}
          caretOffset={caretOffset}
          onAdvance={onAdvance}
          onFocusRequest={onFocusRequest}
        />
      </div>
    );
  }

  const registered = cellTypeRegistry.getIfExists(content.kind);
  if (!registered) {
    return null;
  }

  const Renderer = registered.render;
  return (
    <div className={styles.content}>
      <Suspense fallback={content.kind === 'Code' ? <pre>{content.spec.code}</pre> : null}>
        <Renderer
          content={content}
          isEditing={isEditing}
          autoFocus={autoFocus}
          onChange={(updated) => cell.onContentChange(updated)}
        />
      </Suspense>
    </div>
  );
}

/**
 * The markdown-only behaviors no other cell needs:
 * - Placeholder text and the "/" block-type menu (the same one NotebookAddBlockDivider uses) — keyed
 *   off whether *this cell's own content* is currently empty, not its position in the document. Any
 *   empty markdown cell gets these, and loses them again the moment it has real content — including a
 *   cell the reader typed into, then deleted everything from. The placeholder itself needs no extra
 *   gating here at all: CM6's own placeholder extension already only renders while the document is
 *   empty (see MarkdownCell's `placeholder` prop), so passing the text unconditionally is enough.
 * - `onAdvance` hands the caret to a fresh cell inserted right after this one on Enter — see
 *   MarkdownCell's own onSubmit doc comment.
 * - `focusRequestId` re-asserts the caret on *this* cell even when it was already the target — see
 *   useFocusExtension's own doc comment. Needed because picking Paragraph/Heading from the "/" menu
 *   below converts this cell in place rather than swapping it for a different one.
 */
function SpecialMarkdownCell({
  cell,
  content,
  isEditing,
  autoFocus,
  focusRequestId,
  caretOffset,
  onAdvance,
  onFocusRequest,
}: {
  cell: NotebookCellItem;
  content: Extract<CellContentKind, { kind: 'Markdown' }>;
} & NarrativeCellFocusProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { refs, floatingStyles, context } = useFloating({
    open: menuOpen,
    onOpenChange: setMenuOpen,
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [offset(4), ...floatingUtils.getPositioningMiddleware('bottom-start')],
  });

  // Dismiss the menu on an outside click or Escape — the default useDismiss behavior already skips
  // presses inside `containerRef` (wired below as the reference element) and inside the floating menu
  // itself, matching the reference/floating exclusion this used to hand-roll with document listeners.
  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  useEffect(() => {
    if (containerRef.current) {
      refs.setReference(containerRef.current);
    }
  }, [refs]);

  const handleChange = (updated: CellContentKind) => {
    if (updated.kind !== 'Markdown') {
      return;
    }
    // Persisted like any other keystroke, deliberately including the "/" itself — picking a type
    // below hands `contentForBlockType`'s starter text to the *same* cell (see NotebookLayoutManager's
    // convertCell), and the underlying CodeMirror editor only clears the "/" still sitting in its live
    // document because that starter text genuinely differs from what's already committed here. Skipping
    // this write when the text was exactly "/" left the "/" uncommitted but *also* unreconciled: the
    // editor's own document still showed it, with nothing left to force it back out.
    cell.onContentChange(updated);

    // A lone "/" is a command as much as it is a character: the menu opens alongside it. Any empty
    // markdown cell offers this, not just a specific position — typing "/" as the very first character
    // is what matters, wherever it happens.
    if (updated.spec.text === '/') {
      setMenuOpen(true);
      return;
    }
    // Any other edit — typing past the "/", backspacing it away, pasting over it — means the reader
    // is no longer asking for the menu, even if they never explicitly dismissed it (clicking away or
    // Escape). Without this, backspacing the "/" back to empty left the menu open and disconnected
    // from what the editor actually shows.
    if (menuOpen) {
      setMenuOpen(false);
    }
  };

  const handlePick = (type: NotebookBlockType) => {
    cell.onConvert(type);
    setMenuOpen(false);
    // Picking a type is a mouse click, which moves DOM focus to the button that was clicked, and a
    // pick that changes content.kind (e.g. "Code") unmounts this cell's editor for a different one
    // entirely — neither a mousedown guard nor MarkdownCell's own autoFocus-transition handling alone
    // would bring the caret back on their own. See NotebookCellFrame's own onFocusRequest doc comment.
    onFocusRequest?.();
  };

  return (
    <div ref={containerRef}>
      <MarkdownCell
        content={content}
        isEditing={isEditing}
        autoFocus={autoFocus}
        focusRequestId={focusRequestId}
        caretOffset={caretOffset}
        placeholder={t('notebook.add-block.prompt', 'Type to start writing — press / for blocks')}
        onChange={handleChange}
        onSubmit={onAdvance}
      />
      {menuOpen && (
        <Portal>
          <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>
            <NotebookBlockTypeMenu onPick={handlePick} />
          </div>
        </Portal>
      )}
    </div>
  );
}

// A collapsed cell: shows only the element name, whatever the cell's type.
function CollapsedCell({ name }: { name: string }) {
  const styles = useStyles2(getStyles);

  return <div className={styles.collapsed}>{name}</div>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    height: PANEL_HEIGHT,
    position: 'relative',
  }),
  content: css({
    padding: theme.spacing(1, 0),
  }),
  collapsed: css({
    padding: theme.spacing(1),
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
  }),
});
