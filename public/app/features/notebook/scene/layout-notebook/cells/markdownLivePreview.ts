import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
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
import { Strikethrough } from '@lezer/markdown';

import { type GrafanaTheme2 } from '@grafana/data';
import { toggleSurround } from 'app/plugins/panel/text/v2/editor/editorCommands';

// Inline marks the toolbar (and, later, other callers) can ask "is the selection already X" about.
// Kept here, next to the decoration logic that walks the same tree, so there is one implementation of
// "what formatting applies at this position," not two.
export const BOLD_NODE = 'StrongEmphasis';
export const ITALIC_NODE = 'Emphasis';
export const INLINE_CODE_NODE = 'InlineCode';
export const LINK_NODE = 'Link';
export const STRIKETHROUGH_NODE = 'Strikethrough';

export const markdownLanguageSupport = markdown({ base: markdownLanguage, extensions: [Strikethrough] });

/**
 * Walks from `pos` up through its ancestor nodes, returning the first one whose type is in
 * `typeNames` — e.g. "is the cursor inside bold text, and if so, which node is that." Exported for
 * reuse by the selection format toolbar, which needs the same answer to show a button as active.
 *
 * Tries both of Lezer's `resolve` sides, not just one: `side: 1` finds the node *starting* at `pos`,
 * `side: -1` finds the node *ending* at `pos` — at a node's own trailing edge (most commonly, the
 * cursor at the very end of a cell's last line, e.g. right after typing a fresh list item) there is
 * nothing to its right to descend into, so `side: 1` alone resolves to an ancestor instead and misses
 * the node entirely, even though the cursor is unambiguously "in" it from every other perspective
 * (the decorations covering that same line, drawn by iterating the whole tree rather than resolving a
 * position, don't have this blind spot — that's what made this so easy to miss).
 */
export function findEnclosingMarkNode(tree: Tree, pos: number, typeNames: readonly string[]): SyntaxNode | undefined {
  for (const side of [-1, 1] as const) {
    let node: SyntaxNode | null = tree.resolve(pos, side);
    while (node) {
      if (typeNames.includes(node.name)) {
        return node;
      }
      node = node.parent;
    }
  }
  return undefined;
}

/**
 * Which kind of list `pos` sits inside, if any — drives the Bulleted/Numbered list toolbar buttons'
 * active state, the same way `findEnclosingMarkNode` drives Bold/Italic/etc. (a plain node-type check
 * doesn't fit here: both list kinds share the `ListItem` node, so the answer depends on its parent).
 */
export function enclosingListKind(tree: Tree, pos: number): 'bullet' | 'ordered' | undefined {
  const listItem = findEnclosingMarkNode(tree, pos, ['ListItem']);
  if (listItem?.parent?.name === 'BulletList') {
    return 'bullet';
  }
  if (listItem?.parent?.name === 'OrderedList') {
    return 'ordered';
  }
  return undefined;
}

/**
 * The marker a new list item continuing from `pos` should start with — `'- '` for a bullet, the next
 * number followed by `'. '` for an ordered item — or `undefined` when `pos` isn't on a list line at
 * all, or is on one with nothing but its own marker. That empty-item case is deliberate: pressing Enter
 * on a bare, otherwise-empty bullet is the conventional "I'm done with this list" gesture in most text
 * editors, not "add another empty bullet."
 */
export function nextListContinuation(state: EditorState, pos: number): string | undefined {
  const listItem = findEnclosingMarkNode(syntaxTree(state), pos, ['ListItem']);
  const marker = listItem?.getChild('ListMark');
  if (!listItem || !marker) {
    return undefined;
  }

  const hasContent = state.sliceDoc(marker.to, listItem.to).trim().length > 0;
  if (!hasContent) {
    return undefined;
  }

  if (listItem.parent?.name === 'BulletList') {
    return '- ';
  }
  if (listItem.parent?.name === 'OrderedList') {
    const currentNumber = parseInt(state.sliceDoc(marker.from, marker.to), 10);
    return Number.isNaN(currentNumber) ? undefined : `${currentNumber + 1}. `;
  }
  return undefined;
}

// The closing-marker child name for each inline mark node Shift+Enter needs to step around — see
// newlineInsertionPoint. Bold and italic share EmphasisMark (StrongEmphasis vs. Emphasis is what
// distinguishes them, not the marker's own name).
const INLINE_MARK_CLOSING_TYPES: Record<string, string> = {
  [BOLD_NODE]: 'EmphasisMark',
  [ITALIC_NODE]: 'EmphasisMark',
  [INLINE_CODE_NODE]: 'CodeMark',
  [STRIKETHROUGH_NODE]: 'StrikethroughMark',
};

/**
 * Where a newline should actually land when the cursor sits at `pos` — `pos` unchanged, unless `pos`
 * is exactly at the start of an inline mark's own *closing* marker (bold, italic, inline code, or
 * strikethrough — e.g. right after the last bold letter, right before the closing `**`), in which case
 * the newline moves to just after that marker instead.
 *
 * Splitting the line exactly at `pos` would otherwise land the marker on a line of its own, preceded
 * by whitespace (the inserted newline) — CommonMark's flanking rules require a closing emphasis
 * delimiter to *not* be preceded by whitespace, so the split silently breaks the very formatting the
 * reader was typing inside: `**Hello**` followed by Shift+Enter right there reparses as literal,
 * unformatted `**Hello` on one line and a dangling `**` on the next, not two lines of bold text. This
 * applies whether or not the marker happens to be revealed at that instant (see `overlapsSelection`) —
 * the rule comes from CommonMark's own parsing, not from whether the marker is currently visible.
 */
export function newlineInsertionPoint(tree: Tree, pos: number): number {
  const node = findEnclosingMarkNode(tree, pos, Object.keys(INLINE_MARK_CLOSING_TYPES));
  if (!node) {
    return pos;
  }

  const closingType = INLINE_MARK_CLOSING_TYPES[node.name];
  const markers = node.getChildren(closingType);
  const closing = markers[markers.length - 1];
  return closing && pos === closing.from ? closing.to : pos;
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

/** Pushes a hidden-marker decoration into both the render set and the atomic-ranges set. See `hide`. */
type Hide = (from: number, to: number) => void;

function wrappedMarkDecorations(
  node: SyntaxNodeRef,
  markType: string,
  className: string,
  reveal: boolean,
  ranges: Array<Range<Decoration>>,
  hide: Hide
) {
  // Styled over the node's whole range regardless of `reveal` — markers included when revealed, so
  // the word still reads as bold/italic/etc. even while its raw `**`/`*` is showing.
  ranges.push(Decoration.mark({ class: className }).range(node.from, node.to));

  if (reveal) {
    return;
  }

  for (let child = node.node.firstChild; child; child = child.nextSibling) {
    if (child.name === markType) {
      hide(child.from, child.to);
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
  state: EditorState,
  styles: MarkdownEditorStyles,
  ranges: Array<Range<Decoration>>,
  hide: Hide
) {
  const headingClass = headingLevelClass(styles, level);
  ranges.push(
    Decoration.line({ class: [styles.heading, headingClass].filter(Boolean).join(' ') }).range(
      state.doc.lineAt(node.from).from
    )
  );

  const marker = node.node.getChild('HeaderMark');
  if (!marker) {
    return;
  }
  // The single space between `#` and the heading text reads as part of the marker, not the content.
  const hideTo = state.sliceDoc(marker.to, marker.to + 1) === ' ' ? marker.to + 1 : marker.to;
  hide(marker.from, hideTo);
}

// Links have no dedicated "edit" UI to change an existing URL, so hiding the markup unconditionally
// would make the target permanently invisible and unreachable through this editor — the reveal-near-
// cursor rule below (shared with bold/italic/code/strikethrough) is the only way to get at it.
function linkDecorations(
  node: SyntaxNodeRef,
  reveal: boolean,
  styles: MarkdownEditorStyles,
  ranges: Array<Range<Decoration>>,
  hide: Hide
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
    hide(mark.from, mark.to);
  }
  if (url) {
    hide(url.from, url.to);
  }
}

function blockquoteDecorations(
  node: SyntaxNodeRef,
  state: EditorState,
  styles: MarkdownEditorStyles,
  ranges: Array<Range<Decoration>>,
  hide: Hide
) {
  const fromLine = state.doc.lineAt(node.from).number;
  const toLine = state.doc.lineAt(node.to).number;
  for (let n = fromLine; n <= toLine; n++) {
    ranges.push(Decoration.line({ class: styles.blockquoteLine }).range(state.doc.line(n).from));
  }

  for (let child = node.node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'QuoteMark') {
      // Matches headingDecorations: the space after `>` reads as part of the marker, not the quoted
      // text, so leaving it visible would show up as a stray leading space once `>` itself is hidden.
      const hideTo = state.sliceDoc(child.to, child.to + 1) === ' ' ? child.to + 1 : child.to;
      hide(child.from, hideTo);
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

export interface BuiltDecorations {
  /** Everything rendered: marks, hidden markers, and line decorations. */
  decorations: DecorationSet;
  /**
   * The hidden-marker ranges only, fed into `EditorView.atomicRanges` — without this, the cursor can
   * still land between the characters of a hidden marker even though nothing is rendered there, which
   * looks like formatting toggling on its own as the caret is moved or clicked near it.
   */
  hidden: DecorationSet;
}

/** Exported so tests can inspect the resulting DecorationSet directly against a real parsed doc. */
export function buildDecorations(state: EditorState, styles: MarkdownEditorStyles): BuiltDecorations {
  const tree = syntaxTree(state);
  const { main } = state.selection;
  const ranges: Array<Range<Decoration>> = [];
  const hiddenRanges: Array<Range<Decoration>> = [];

  const hide: Hide = (from, to) => {
    ranges.push(Decoration.replace({}).range(from, to));
    hiddenRanges.push(Decoration.replace({}).range(from, to));
  };

  tree.iterate({
    enter(node) {
      const headingMatch = HEADING_NODE_PATTERN.exec(node.name);

      if (headingMatch) {
        headingDecorations(node, Number(headingMatch[1]), state, styles, ranges, hide);
      } else if (node.name === BOLD_NODE) {
        wrappedMarkDecorations(
          node,
          'EmphasisMark',
          styles.bold,
          overlapsSelection(main, node.from, node.to),
          ranges,
          hide
        );
      } else if (node.name === ITALIC_NODE) {
        wrappedMarkDecorations(
          node,
          'EmphasisMark',
          styles.italic,
          overlapsSelection(main, node.from, node.to),
          ranges,
          hide
        );
      } else if (node.name === INLINE_CODE_NODE) {
        wrappedMarkDecorations(
          node,
          'CodeMark',
          styles.inlineCode,
          overlapsSelection(main, node.from, node.to),
          ranges,
          hide
        );
      } else if (node.name === STRIKETHROUGH_NODE) {
        wrappedMarkDecorations(
          node,
          'StrikethroughMark',
          styles.strikethrough,
          overlapsSelection(main, node.from, node.to),
          ranges,
          hide
        );
      } else if (node.name === LINK_NODE) {
        linkDecorations(node, overlapsSelection(main, node.from, node.to), styles, ranges, hide);
      } else if (node.name === 'Blockquote') {
        blockquoteDecorations(node, state, styles, ranges, hide);
      } else if (node.name === 'ListItem') {
        listItemDecorations(node, state, styles, ranges);
      }
      // Deliberately out of scope for now: HorizontalRule, FencedCode, and GFM tables (the base
      // markdown parser this editor uses doesn't include the table extension). Add a case above and a
      // matching style if any of these get picked up as a V2 for this editor.
    },
  });

  return { decorations: Decoration.set(ranges, true), hidden: Decoration.set(hiddenRanges, true) };
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
  strikethrough: string;
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
    strikethrough: 'cm-md-strikethrough',
    link: 'cm-md-link',
    blockquoteLine: 'cm-md-blockquote-line',
    listItemLine: 'cm-md-list-item-line',
  };

  const themeExtension = EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.body.fontSize,
    },
    '.cm-content': {
      caretColor: theme.colors.text.primary,
      padding: 0,
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: theme.colors.text.primary,
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: `${theme.colors.action.selected} !important`,
    },
    // @codemirror/view's own base theme (bundled unconditionally, independent of this theme entirely)
    // gives every focused editor a hardcoded `outline: 1px dotted #212121` "so a focused editor is
    // visually distinct" — reasonable for a bare code editor, wrong here, where a notebook cell reads
    // as part of a document rather than a boxed input. CodeEditor.tsx's own generic theme overrides
    // this the same way (with Grafana's focus ring instead); this cell just goes bare.
    '&.cm-focused': {
      outline: 'none',
    },
    // highlightActiveLine (part of basicSetup) carries no styling of its own — the visible highlight
    // comes from @codemirror/view's own baseTheme (`&light .cm-activeLine`/`&dark ...`), which sits
    // beneath this theme and shows through for any selector this theme doesn't itself define. A
    // notebook cell has nothing that needs to stand out as "the active line" the way a code editor
    // does, so this is transparent rather than given its own subtler color.
    '.cm-activeLine, .cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
    // Shown only once the cell actually has the caret — an unfocused "Type to start writing" reads as
    // a document's own idle state, where a permanently visible one looks like leftover placeholder
    // copy on an inert block.
    '.cm-placeholder': {
      visibility: 'hidden',
    },
    '&.cm-focused .cm-placeholder': {
      visibility: 'visible',
    },
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
    [`.${classes.strikethrough}`]: {
      textDecoration: 'line-through',
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

export interface MarkdownLivePreview {
  /**
   * Pass as CodeMirrorEditor's dedicated `theme` prop, not layered into `extensions` — see the
   * comment inside buildEditorStyles for why a layered theme can't reliably win against the default.
   */
  theme: Extension;
  /** Pass as CodeMirrorEditor's `extensions` prop, alongside anything else (e.g. a focus request). */
  extensions: Extension;
}

/**
 * Live preview for a markdown editor: hides `**`/`#`/etc. markers and applies the corresponding
 * formatting inline, based on the markdown syntax tree — except where the cursor currently sits.
 * Bold/italic/code/strikethrough/links all reveal their raw markup while the selection overlaps them
 * (see `overlapsSelection`), so editing right at a marker's boundary is just normal text editing —
 * CM6's own Backspace/typing/IME handling, no special-casing needed — rather than fighting a hidden,
 * atomic marker that renders zero-width but still occupies real document positions. Storage is
 * unaffected: this is purely a view-layer decoration over the same plain markdown string CodeCell-style
 * editors already use, plus the Cmd+B/Cmd+I keymap for toggling bold/italic.
 */
export function markdownLivePreview(theme: GrafanaTheme2): MarkdownLivePreview {
  const { theme: themeExtension, classes } = buildEditorStyles(theme);

  const decorationPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      hidden: DecorationSet;

      constructor(view: EditorView) {
        ({ decorations: this.decorations, hidden: this.hidden } = buildDecorations(view.state, classes));
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          ({ decorations: this.decorations, hidden: this.hidden } = buildDecorations(update.state, classes));
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );

  return {
    theme: themeExtension,
    extensions: [
      // Bundled in here rather than exposed as a second thing MarkdownCell.tsx has to remember to
      // include — the language and the live preview built on top of its syntax tree are one cohesive
      // unit, not two independent concerns.
      markdownLanguageSupport,
      decorationPlugin,
      // Makes CM6 skip over a hidden marker in one step (cursor movement, clicks, deletion) rather
      // than treating its characters as ordinary, just invisible, text — see BuiltDecorations.hidden.
      // Only ever applies to markers that are actually hidden: a marker revealed near the cursor (see
      // this function's own doc comment) isn't in `hidden` at all, so typing/backspacing through it
      // behaves like plain text with no atomic-range interference.
      EditorView.atomicRanges.of((view) => view.plugin(decorationPlugin)?.hidden ?? Decoration.none),
      keymap.of(buildKeymap()),
    ],
  };
}
