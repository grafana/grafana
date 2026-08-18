import { syntaxTree } from '@codemirror/language';
import { type EditorState, type Extension, type Range, type SelectionRange } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  type KeyBinding,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { type SyntaxNode, type SyntaxNodeRef, type Tree } from '@lezer/common';

import { type GrafanaTheme2 } from '@grafana/data';
// toggleSurround/toggleLinePrefix already exist, pure and CM6-only, in the Text panel's own markdown
// editor. That path is owned by @grafana/dataviz-squad; this one is owned by @grafana/sharing-squad
// (see .github/CODEOWNERS) — different squads, so this is a deliberate cross-import rather than a
// duplicate of ~140 lines of selection-mutation logic, not an oversight. Extract to a shared
// @grafana/ui location (e.g. @grafana/ui/unstable) if this dependency needs to be made official.
import { toggleSurround } from 'app/plugins/panel/text/v2/editor/editorCommands';

// Inline marks the toolbar (and, later, other callers) can ask "is the selection already X" about.
// Kept here, next to the decoration logic that walks the same tree, so there is one implementation of
// "what formatting applies at this position," not two.
export const BOLD_NODE = 'StrongEmphasis';
export const ITALIC_NODE = 'Emphasis';
export const INLINE_CODE_NODE = 'InlineCode';
export const LINK_NODE = 'Link';

/**
 * Walks from `pos` up through its ancestor nodes, returning the first one whose type is in
 * `typeNames` — e.g. "is the cursor inside bold text, and if so, which node is that." Exported for
 * reuse by the selection format toolbar, which needs the same answer to show a button as active.
 */
export function findEnclosingMarkNode(tree: Tree, pos: number, typeNames: readonly string[]): SyntaxNode | undefined {
  let node: SyntaxNode | null = tree.resolve(pos, 1);
  while (node) {
    if (typeNames.includes(node.name)) {
      return node;
    }
    node = node.parent;
  }
  return undefined;
}

/**
 * Whether the current selection overlaps `[from, to)` — the rule for "reveal this node's raw markers
 * instead of hiding them." A collapsed caret counts as overlapping only when it sits strictly inside
 * the range, not merely adjacent to it: a caret right after `**bold**` with no gap should not re-reveal
 * markers the reader has already typed past. Exported for direct unit testing of the boundary cases.
 */
export function overlapsSelection(selection: SelectionRange, from: number, to: number): boolean {
  return selection.from < to && from < selection.to;
}

function wrappedMarkDecorations(
  node: SyntaxNodeRef,
  markType: string,
  className: string,
  reveal: boolean,
  ranges: Array<Range<Decoration>>
) {
  // Styled over the node's whole range, markers included — hidden markers make that invisible, and a
  // revealed marker rendering in the same weight/style as its content is normal (matches Obsidian).
  ranges.push(Decoration.mark({ class: className }).range(node.from, node.to));

  if (reveal) {
    return;
  }

  for (let child = node.node.firstChild; child; child = child.nextSibling) {
    if (child.name === markType) {
      ranges.push(Decoration.replace({}).range(child.from, child.to));
    }
  }
}

// h5/h6 get only the shared `heading` class (margin/weight), matching the static renderer, which
// never gave them their own font-size rule either.
function headingLevelClass(styles: MarkdownEditorStyles, level: number): string | undefined {
  switch (level) {
    case 1:
      return styles.heading1;
    case 2:
      return styles.heading2;
    case 3:
      return styles.heading3;
    case 4:
      return styles.heading4;
    default:
      return undefined;
  }
}

function headingDecorations(
  node: SyntaxNodeRef,
  level: number,
  reveal: boolean,
  state: EditorState,
  styles: MarkdownEditorStyles,
  ranges: Array<Range<Decoration>>
) {
  const headingClass = headingLevelClass(styles, level);
  ranges.push(
    Decoration.line({ class: [styles.heading, headingClass].filter(Boolean).join(' ') }).range(
      state.doc.lineAt(node.from).from
    )
  );

  if (reveal) {
    return;
  }

  const marker = node.node.getChild('HeaderMark');
  if (!marker) {
    return;
  }
  // The single space between `#` and the heading text reads as part of the marker, not the content.
  const hideTo = state.sliceDoc(marker.to, marker.to + 1) === ' ' ? marker.to + 1 : marker.to;
  ranges.push(Decoration.replace({}).range(marker.from, hideTo));
}

function linkDecorations(
  node: SyntaxNodeRef,
  reveal: boolean,
  styles: MarkdownEditorStyles,
  ranges: Array<Range<Decoration>>
) {
  const linkMarks: SyntaxNode[] = [];
  let url: SyntaxNode | undefined;
  for (let child = node.node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'LinkMark') {
      linkMarks.push(child);
    } else if (child.name === 'URL') {
      url = child;
    }
  }

  // A well-formed `[text](url)` has exactly the four marks below; anything else is a link the parser
  // couldn't fully resolve (still being typed), and is left alone rather than mis-decorated.
  if (linkMarks.length < 2) {
    return;
  }

  const [open, close] = linkMarks;
  ranges.push(Decoration.mark({ class: styles.link }).range(open.to, close.from));

  if (reveal) {
    return;
  }

  for (const mark of linkMarks) {
    ranges.push(Decoration.replace({}).range(mark.from, mark.to));
  }
  if (url) {
    ranges.push(Decoration.replace({}).range(url.from, url.to));
  }
}

function blockquoteDecorations(
  node: SyntaxNodeRef,
  reveal: boolean,
  state: EditorState,
  styles: MarkdownEditorStyles,
  ranges: Array<Range<Decoration>>
) {
  const fromLine = state.doc.lineAt(node.from).number;
  const toLine = state.doc.lineAt(node.to).number;
  for (let n = fromLine; n <= toLine; n++) {
    ranges.push(Decoration.line({ class: styles.blockquoteLine }).range(state.doc.line(n).from));
  }

  if (reveal) {
    return;
  }

  for (let child = node.node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'QuoteMark') {
      ranges.push(Decoration.replace({}).range(child.from, child.to));
    }
  }
}

// Unlike every other construct above, list markers (`-`, `1.`) are never hidden: there is no styled
// substitute for them the way bold text substitutes for `**bold**` — the marker *is* the list's visual
// affordance. Only indentation/spacing is applied, and it applies unconditionally (no reveal rule).
function listItemDecorations(
  node: SyntaxNodeRef,
  state: EditorState,
  styles: MarkdownEditorStyles,
  ranges: Array<Range<Decoration>>
) {
  const fromLine = state.doc.lineAt(node.from).number;
  const toLine = state.doc.lineAt(node.to).number;
  for (let n = fromLine; n <= toLine; n++) {
    ranges.push(Decoration.line({ class: styles.listItemLine }).range(state.doc.line(n).from));
  }
}

const HEADING_NODE_PATTERN = /^ATXHeading([1-6])$/;

/** Exported so tests can inspect the resulting DecorationSet directly against a real parsed doc. */
export function buildDecorations(state: EditorState, styles: MarkdownEditorStyles): DecorationSet {
  const tree = syntaxTree(state);
  const { main } = state.selection;
  const ranges: Array<Range<Decoration>> = [];

  tree.iterate({
    enter(node) {
      const headingMatch = HEADING_NODE_PATTERN.exec(node.name);
      const reveal = overlapsSelection(main, node.from, node.to);

      if (headingMatch) {
        headingDecorations(node, Number(headingMatch[1]), reveal, state, styles, ranges);
      } else if (node.name === BOLD_NODE) {
        wrappedMarkDecorations(node, 'EmphasisMark', styles.bold, reveal, ranges);
      } else if (node.name === ITALIC_NODE) {
        wrappedMarkDecorations(node, 'EmphasisMark', styles.italic, reveal, ranges);
      } else if (node.name === INLINE_CODE_NODE) {
        wrappedMarkDecorations(node, 'CodeMark', styles.inlineCode, reveal, ranges);
      } else if (node.name === LINK_NODE) {
        linkDecorations(node, reveal, styles, ranges);
      } else if (node.name === 'Blockquote') {
        blockquoteDecorations(node, reveal, state, styles, ranges);
      } else if (node.name === 'ListItem') {
        listItemDecorations(node, state, styles, ranges);
      }
      // Deliberately out of scope for now: HorizontalRule, FencedCode, and GFM tables (the base
      // markdown parser this editor uses doesn't include the table extension). Add a case above and a
      // matching style if any of these get picked up as a V2 for this editor.
    },
  });

  return Decoration.set(ranges, true);
}

export interface MarkdownEditorStyles {
  heading: string;
  heading1: string;
  heading2: string;
  heading3: string;
  heading4: string;
  bold: string;
  italic: string;
  inlineCode: string;
  link: string;
  blockquoteLine: string;
  listItemLine: string;
}

/**
 * Mirrors MarkdownCell's own not-editing styles (getStyles in MarkdownCell.tsx) so entering and
 * leaving edit mode doesn't change how the cell reads — same theme numbers, same look, just live
 * instead of static.
 */
function buildEditorStyles(theme: GrafanaTheme2): { theme: Extension; classes: MarkdownEditorStyles } {
  const classes: MarkdownEditorStyles = {
    heading: 'cm-md-heading',
    heading1: 'cm-md-h1',
    heading2: 'cm-md-h2',
    heading3: 'cm-md-h3',
    heading4: 'cm-md-h4',
    bold: 'cm-md-bold',
    italic: 'cm-md-italic',
    inlineCode: 'cm-md-inline-code',
    link: 'cm-md-link',
    blockquoteLine: 'cm-md-blockquote-line',
    listItemLine: 'cm-md-list-item-line',
  };

  const themeExtension = EditorView.theme({
    [`.${classes.heading}`]: {
      fontWeight: theme.typography.fontWeightMedium,
    },
    [`.${classes.heading1}`]: {
      fontSize: theme.typography.h1.fontSize,
      lineHeight: `${theme.typography.h1.lineHeight}`,
    },
    [`.${classes.heading2}`]: {
      fontSize: theme.typography.h2.fontSize,
      lineHeight: `${theme.typography.h2.lineHeight}`,
    },
    [`.${classes.heading3}`]: {
      fontSize: theme.typography.h3.fontSize,
      lineHeight: `${theme.typography.h3.lineHeight}`,
    },
    [`.${classes.heading4}`]: {
      fontSize: theme.typography.h4.fontSize,
    },
    [`.${classes.bold}`]: {
      fontWeight: theme.typography.fontWeightBold,
    },
    [`.${classes.italic}`]: {
      fontStyle: 'italic',
    },
    [`.${classes.inlineCode}`]: {
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      padding: '0 4px',
    },
    [`.${classes.link}`]: {
      color: theme.colors.text.link,
      textDecoration: 'underline',
    },
    [`.${classes.blockquoteLine}`]: {
      borderLeft: `3px solid ${theme.colors.border.strong}`,
      paddingLeft: '8px',
      color: theme.colors.text.secondary,
    },
    [`.${classes.listItemLine}`]: {
      paddingLeft: '2px',
    },
  });

  return { theme: themeExtension, classes };
}

/** `Mod-` is CM6's platform-aware modifier (Cmd on macOS, Ctrl elsewhere). */
function buildKeymap(): readonly KeyBinding[] {
  return [
    {
      key: 'Mod-b',
      run: (view) => {
        toggleSurround(view, '**');
        return true;
      },
    },
    {
      key: 'Mod-i',
      run: (view) => {
        toggleSurround(view, '*');
        return true;
      },
    },
  ];
}

/**
 * Notion/Obsidian-style live preview for a markdown editor: hides `**`/`#`/etc. markers and applies
 * the corresponding formatting inline, based on the markdown syntax tree and the current selection —
 * a node's markers stay hidden unless the selection currently overlaps it, so editing a styled run
 * shows its raw markdown without disturbing the rest of the document. Storage is unaffected: this is
 * purely a view-layer decoration over the same plain markdown string CodeCell-style editors already
 * use, plus the Cmd+B/Cmd+I keymap for toggling bold/italic.
 */
export function markdownLivePreview(theme: GrafanaTheme2): Extension {
  const { theme: themeExtension, classes } = buildEditorStyles(theme);

  const decorationPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view.state, classes);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildDecorations(update.state, classes);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );

  return [themeExtension, decorationPlugin, keymap.of(buildKeymap())];
}
