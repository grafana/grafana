import { syntaxTree } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { css } from '@emotion/css';
import { offset, useDismiss, useFloating, useInteractions, type VirtualElement } from '@floating-ui/react';
import { type Tree } from '@lezer/common';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { floatingUtils, Portal, Stack, ToolbarButton, useStyles2 } from '@grafana/ui';
import { toggleLinePrefix, toggleOrderedList, toggleSurround } from 'app/plugins/panel/text/v2/editor/editorCommands';

import {
  BOLD_NODE,
  enclosingListKind,
  findEnclosingMarkNode,
  INLINE_CODE_NODE,
  ITALIC_NODE,
  LINK_NODE,
  STRIKETHROUGH_NODE,
} from './markdownLivePreview';

export const MARKDOWN_FORMAT_TOOLBAR_TEST_ID = 'notebook-markdown-format-toolbar';

interface Props {
  editorContainerRef: RefObject<HTMLDivElement | null>;
}

interface FormatAction {
  key: string;
  tooltip: string;
  icon?: IconName;
  label?: ReactNode;
  isActive: (tree: Tree, pos: number) => boolean;
  run: (view: EditorView) => void;
}

function actions(): FormatAction[] {
  return [
    {
      key: 'bold',
      tooltip: t('notebook.cell.markdown.tooltip-bold', 'Bold'),
      label: <strong>{t('notebook.cell.markdown.format-bold', 'B')}</strong>,
      isActive: (tree, pos) => Boolean(findEnclosingMarkNode(tree, pos, [BOLD_NODE])),
      run: (view) => toggleSurround(view, '**'),
    },
    {
      key: 'italic',
      tooltip: t('notebook.cell.markdown.tooltip-italic', 'Italic'),
      label: <em>{t('notebook.cell.markdown.format-italic', 'I')}</em>,
      isActive: (tree, pos) => Boolean(findEnclosingMarkNode(tree, pos, [ITALIC_NODE])),
      run: (view) => toggleSurround(view, '*'),
    },
    {
      key: 'strikethrough',
      tooltip: t('notebook.cell.markdown.tooltip-strikethrough', 'Strikethrough'),
      label: <s>{t('notebook.cell.markdown.format-strikethrough', 'S')}</s>,
      isActive: (tree, pos) => Boolean(findEnclosingMarkNode(tree, pos, [STRIKETHROUGH_NODE])),
      run: (view) => toggleSurround(view, '~~'),
    },
    {
      key: 'code',
      tooltip: t('notebook.cell.markdown.tooltip-code', 'Code'),
      icon: 'brackets-curly',
      isActive: (tree, pos) => Boolean(findEnclosingMarkNode(tree, pos, [INLINE_CODE_NODE])),
      run: (view) => toggleSurround(view, '`'),
    },
    {
      key: 'link',
      tooltip: t('notebook.cell.markdown.tooltip-link', 'Link'),
      icon: 'link',
      isActive: (tree, pos) => Boolean(findEnclosingMarkNode(tree, pos, [LINK_NODE])),
      run: (view) => toggleSurround(view, '[', '](https://)'),
    },
    {
      key: 'bulleted-list',
      tooltip: t('notebook.cell.markdown.tooltip-bulleted-list', 'Bulleted list'),
      icon: 'list-ul',
      isActive: (tree, pos) => enclosingListKind(tree, pos) === 'bullet',
      run: (view) => toggleLinePrefix(view, '- '),
    },
    {
      key: 'numbered-list',
      tooltip: t('notebook.cell.markdown.tooltip-numbered-list', 'Numbered list'),
      icon: 'list-ol',
      isActive: (tree, pos) => enclosingListKind(tree, pos) === 'ordered',
      run: (view) => toggleOrderedList(view),
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
 * Floating bold/italic/strikethrough/code/link/list bar that appears while the reader has text selected inside a
 * markdown cell's editor. Positioned off the CodeMirror
 * selection's own coordinates.
 */
export function MarkdownFormatToolbar({ editorContainerRef }: Props) {
  const styles = useStyles2(getStyles);
  const [view, setView] = useState<EditorView | null>(null);
  const [hasSelection, setHasSelection] = useState(false);

  const { refs, floatingStyles, update, context } = useFloating({
    open: hasSelection,
    onOpenChange: setHasSelection,
    placement: 'top',
    strategy: 'fixed',
    middleware: [offset(8), ...floatingUtils.getPositioningMiddleware('top')],
  });

  const dismiss = useDismiss(context, {
    outsidePress: (event) => !(event.target instanceof Node && editorContainerRef.current?.contains(event.target)),
  });
  const { getFloatingProps } = useInteractions([dismiss]);

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
        // A group of controls, same as the always-visible TextNGFormatToolbar — the buttons inside
        // carry their own focus/keyboard handling, this just names the group for assistive tech.
        role="toolbar"
        {...getFloatingProps({
          // A click's mousedown fires — and, by default, moves focus to the clicked button — before
          // its own click event does. Since this panel is portaled outside the editor's own DOM
          // subtree, that default focus change would move the caret away from the CM6 view before the
          // toggleSurround click ever runs, losing the very selection the button was about to format.
          // Suppressing the default here keeps focus (and the CM6 selection) exactly where it was; the
          // click still fires normally afterward.
          onMouseDown: (event) => event.preventDefault(),
        })}
      >
        <Stack direction="row" gap={0.5} alignItems="center">
          {actions().map((action) => (
            <ToolbarButton
              key={action.key}
              icon={action.icon}
              tooltip={action.tooltip}
              variant={action.isActive(tree, pos) ? 'primary' : 'default'}
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
