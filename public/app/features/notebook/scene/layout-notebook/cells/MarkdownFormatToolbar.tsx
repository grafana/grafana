import { syntaxTree } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { css } from '@emotion/css';
import { offset, useFloating, type VirtualElement } from '@floating-ui/react';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { floatingUtils, Portal, Stack, ToolbarButton, useStyles2 } from '@grafana/ui';
import { toggleSurround } from 'app/plugins/panel/text/v2/editor/editorCommands';

import { BOLD_NODE, findEnclosingMarkNode, INLINE_CODE_NODE, ITALIC_NODE, LINK_NODE } from './markdownLivePreview';

export const MARKDOWN_FORMAT_TOOLBAR_TEST_ID = 'notebook-markdown-format-toolbar';

interface Props {
  /**
   * Wrapper the CodeMirror editor is mounted into. The lazily-loaded bundle does not expose its
   * `EditorView`, so it is looked up from this container's DOM — the same trick
   * TextNGFormatToolbar.tsx uses for the Text panel's own (always-visible) formatting toolbar.
   */
  editorContainerRef: RefObject<HTMLDivElement | null>;
}

interface FormatAction {
  key: string;
  tooltip: string;
  icon?: IconName;
  label?: ReactNode;
  /** Syntax node types that mean "this formatting already applies here" — drives the active state. */
  nodeTypes: readonly string[];
  run: (view: EditorView) => void;
}

function actions(): FormatAction[] {
  return [
    {
      key: 'bold',
      tooltip: t('notebook.cell.markdown.tooltip-bold', 'Bold'),
      label: <strong>{t('notebook.cell.markdown.format-bold', 'B')}</strong>,
      nodeTypes: [BOLD_NODE],
      run: (view) => toggleSurround(view, '**'),
    },
    {
      key: 'italic',
      tooltip: t('notebook.cell.markdown.tooltip-italic', 'Italic'),
      label: <em>{t('notebook.cell.markdown.format-italic', 'I')}</em>,
      nodeTypes: [ITALIC_NODE],
      run: (view) => toggleSurround(view, '*'),
    },
    {
      key: 'code',
      tooltip: t('notebook.cell.markdown.tooltip-code', 'Code'),
      icon: 'brackets-curly',
      nodeTypes: [INLINE_CODE_NODE],
      run: (view) => toggleSurround(view, '`'),
    },
    {
      key: 'link',
      tooltip: t('notebook.cell.markdown.tooltip-link', 'Link'),
      icon: 'link',
      nodeTypes: [LINK_NODE],
      run: (view) => toggleSurround(view, '[', '](https://)'),
    },
  ];
}

/** A virtual floating-ui reference spanning the selection's start to its end, in viewport coordinates. */
function selectionVirtualElement(view: EditorView): VirtualElement {
  return {
    getBoundingClientRect: () => {
      const { from, to } = view.state.selection.main;
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);

      if (!start || !end) {
        return new DOMRect(0, 0, 0, 0);
      }

      const left = Math.min(start.left, end.left);
      const top = Math.min(start.top, end.top);
      const right = Math.max(start.right, end.right);
      const bottom = Math.max(start.bottom, end.bottom);
      return new DOMRect(left, top, right - left, bottom - top);
    },
  };
}

/**
 * Floating bold/italic/code/link bar that appears while the reader has text selected inside a
 * markdown cell's editor, mirroring Notion/Obsidian's selection toolbar. Positioned off the CM6
 * selection's own coordinates (not the DOM selection window.getSelection() would give — CM6 manages
 * its content itself), reusing floating-ui the same way Typeahead.tsx anchors to a text selection.
 */
export function MarkdownFormatToolbar({ editorContainerRef }: Props) {
  const styles = useStyles2(getStyles);
  const [view, setView] = useState<EditorView | null>(null);
  const [hasSelection, setHasSelection] = useState(false);

  const { refs, floatingStyles, update } = useFloating({
    open: hasSelection,
    placement: 'top',
    strategy: 'fixed',
    middleware: [offset(8), ...floatingUtils.getPositioningMiddleware('top')],
  });

  // CodeMirrorEditor exposes no selection-change prop, so the container is polled the same way
  // TextNGFormatToolbar recovers its view: found from the DOM node it's mounted into. mouseup/keyup
  // catch pointer and keyboard selection; selectionchange catches everything else (e.g. select-all).
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) {
      return;
    }

    const checkSelection = () => {
      const currentView = EditorView.findFromDOM(container);
      setView(currentView);

      const selection = currentView?.state.selection.main;
      const nonEmpty = Boolean(selection && !selection.empty);
      setHasSelection(nonEmpty);

      if (nonEmpty && currentView) {
        refs.setReference(selectionVirtualElement(currentView));
        update();
      }
    };

    container.addEventListener('mouseup', checkSelection);
    container.addEventListener('keyup', checkSelection);
    document.addEventListener('selectionchange', checkSelection);
    return () => {
      container.removeEventListener('mouseup', checkSelection);
      container.removeEventListener('keyup', checkSelection);
      document.removeEventListener('selectionchange', checkSelection);
    };
  }, [editorContainerRef, refs, update]);

  // Dismiss on a click outside both the editor and the bar itself — a different cell, or leaving
  // edit mode entirely. Modelled on usePopoverMenu.ts's outside-click dismissal in Explore Logs,
  // which shows the same "select text -> floating action menu -> dismiss outside it" shape for a
  // different set of actions.
  useEffect(() => {
    if (!hasSelection) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (editorContainerRef.current?.contains(target) || refs.floating.current?.contains(target)) {
        return;
      }
      setHasSelection(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [hasSelection, editorContainerRef, refs.floating]);

  if (!hasSelection || !view) {
    return null;
  }

  const tree = syntaxTree(view.state);
  const pos = view.state.selection.main.from;

  const runAction = (action: FormatAction) => {
    action.run(view);
    // toggleSurround already calls view.focus() and may collapse the selection (e.g. removing
    // markers moves the caret) — re-check once the dispatch has settled rather than assume it stays.
    requestAnimationFrame(() => setHasSelection(!view.state.selection.main.empty));
  };

  return (
    <Portal>
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        className={styles.panel}
        data-testid={MARKDOWN_FORMAT_TOOLBAR_TEST_ID}
      >
        <Stack direction="row" gap={0.5} alignItems="center">
          {actions().map((action) => (
            <ToolbarButton
              key={action.key}
              icon={action.icon}
              tooltip={action.tooltip}
              isHighlighted={Boolean(findEnclosingMarkNode(tree, pos, action.nodeTypes))}
              onClick={() => runAction(action)}
            >
              {action.label}
            </ToolbarButton>
          ))}
        </Stack>
      </div>
    </Portal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    zIndex: theme.zIndex.tooltip,
    display: 'flex',
    padding: theme.spacing(0.5),
    backgroundColor: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z2,
  }),
});
