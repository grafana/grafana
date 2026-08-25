import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { EditorSelection, EditorState } from '@codemirror/state';
import { type DecorationSet } from '@codemirror/view';

import {
  BOLD_NODE,
  buildDecorations,
  enclosingListKind,
  findEnclosingMarkNode,
  INLINE_CODE_NODE,
  ITALIC_NODE,
  LINK_NODE,
  markdownLanguageSupport,
  overlapsSelection,
  STRIKETHROUGH_NODE,
  type MarkdownEditorStyles,
} from './markdownLivePreview';

// CodeMirror's own state/parsing layer (unlike the React-wrapped, lazily loaded editor component) runs
// fine outside a browser, so the syntax-tree-driven logic here is tested directly against a real
// EditorState rather than through a jsdom-mocked textarea. Uses the same markdownLanguageSupport the
// real component does (rather than a bare markdown() call) so Strikethrough parses the same way here.
function createState(doc: string, selection?: { anchor: number; head?: number }) {
  const state = EditorState.create({
    doc,
    selection: selection ? EditorSelection.single(selection.anchor, selection.head ?? selection.anchor) : undefined,
    extensions: [markdownLanguageSupport],
  });

  // Without a live EditorView driving background parsing, the tree only exists once forced — this is
  // exactly what ensureSyntaxTree is for (tooling/tests that need a synchronous, complete parse).
  ensureSyntaxTree(state, state.doc.length, 5000);
  return state;
}

const STYLES: MarkdownEditorStyles = {
  heading: 'heading',
  heading1: 'h1',
  heading2: 'h2',
  heading3: 'h3',
  heading4: 'h4',
  bold: 'bold',
  italic: 'italic',
  inlineCode: 'inline-code',
  strikethrough: 'strikethrough',
  link: 'link',
  blockquoteLine: 'blockquote-line',
  listItemLine: 'list-item-line',
};

/** Every decoration in the given set as a plain, order-independent, easy-to-assert-on record. */
function recordsIn(decorations: DecorationSet, docLength: number) {
  const out: Array<{ from: number; to: number; class?: string; hidden: boolean }> = [];

  decorations.between(0, docLength, (from, to, deco) => {
    const spec = deco.spec as { class?: string };
    out.push({ from, to, class: spec.class, hidden: spec.class === undefined });
  });

  return out;
}

function decorationsIn(state: EditorState, styles: MarkdownEditorStyles) {
  return recordsIn(buildDecorations(state, styles).decorations, state.doc.length);
}

/** The atomic-ranges set fed to EditorView.atomicRanges — should mirror every hidden marker. */
function hiddenRangesIn(state: EditorState, styles: MarkdownEditorStyles) {
  return recordsIn(buildDecorations(state, styles).hidden, state.doc.length);
}

function isHidden(decorations: ReturnType<typeof decorationsIn>, from: number, to: number) {
  return decorations.some((d) => d.hidden && d.from === from && d.to === to);
}

function hasClass(decorations: ReturnType<typeof decorationsIn>, from: number, to: number, className: string) {
  return decorations.some((d) => d.class === className && d.from <= from && d.to >= to);
}

describe('overlapsSelection', () => {
  const range = (from: number, to: number) => EditorSelection.range(from, to);

  it('does not overlap a caret strictly before the range', () => {
    expect(overlapsSelection(range(0, 0), 2, 6)).toBe(false);
  });

  it('does not overlap a caret sitting exactly at the range start', () => {
    expect(overlapsSelection(range(2, 2), 2, 6)).toBe(false);
  });

  it('overlaps a caret strictly inside the range', () => {
    expect(overlapsSelection(range(4, 4), 2, 6)).toBe(true);
  });

  it('does not overlap a caret sitting exactly at the range end', () => {
    expect(overlapsSelection(range(6, 6), 2, 6)).toBe(false);
  });

  it('does not overlap a caret strictly after the range', () => {
    expect(overlapsSelection(range(8, 8), 2, 6)).toBe(false);
  });

  it('overlaps a selection that partially covers the range', () => {
    expect(overlapsSelection(range(0, 4), 2, 6)).toBe(true);
  });

  it('overlaps a selection the range is fully inside of', () => {
    expect(overlapsSelection(range(0, 10), 2, 6)).toBe(true);
  });
});

describe('findEnclosingMarkNode', () => {
  it('finds the bold node a cursor sits inside', () => {
    const state = createState('a **bold** b');
    const tree = syntaxTree(state);

    // Inside "bold", between the two `**` marker pairs.
    const node = findEnclosingMarkNode(tree, 5, [BOLD_NODE]);

    expect(node?.name).toBe(BOLD_NODE);
  });

  it('finds the italic node a cursor sits inside', () => {
    const state = createState('a *italic* b');
    const tree = syntaxTree(state);

    const node = findEnclosingMarkNode(tree, 5, [ITALIC_NODE]);

    expect(node?.name).toBe(ITALIC_NODE);
  });

  it('finds the inline code node a cursor sits inside', () => {
    const state = createState('a `code` b');
    const tree = syntaxTree(state);

    const node = findEnclosingMarkNode(tree, 4, [INLINE_CODE_NODE]);

    expect(node?.name).toBe(INLINE_CODE_NODE);
  });

  it('finds the link node a cursor sits inside', () => {
    const state = createState('a [text](https://example.com) b');
    const tree = syntaxTree(state);

    const node = findEnclosingMarkNode(tree, 4, [LINK_NODE]);

    expect(node?.name).toBe(LINK_NODE);
  });

  it('finds the strikethrough node a cursor sits inside', () => {
    const state = createState('a ~~strike~~ b');
    const tree = syntaxTree(state);

    const node = findEnclosingMarkNode(tree, 6, [STRIKETHROUGH_NODE]);

    expect(node?.name).toBe(STRIKETHROUGH_NODE);
  });

  it('finds nothing at a position with none of the requested marks', () => {
    const state = createState('plain text');
    const tree = syntaxTree(state);

    const node = findEnclosingMarkNode(tree, 3, [BOLD_NODE, ITALIC_NODE, INLINE_CODE_NODE, LINK_NODE]);

    expect(node).toBeUndefined();
  });
});

describe('buildDecorations', () => {
  it('hides bold markers and styles the content when the cursor is elsewhere', () => {
    const state = createState('a **bold** b', { anchor: 0 });
    const decorations = decorationsIn(state, STYLES);

    // "**bold**" spans [2, 10); the markers are the first and last two characters.
    expect(isHidden(decorations, 2, 4)).toBe(true);
    expect(isHidden(decorations, 8, 10)).toBe(true);
    expect(hasClass(decorations, 4, 8, STYLES.bold)).toBe(true);
  });

  // Reveals near the cursor, same as links (see the reveal tests further down): editing right at a
  // marker's own boundary then behaves like plain text — normal Backspace, normal typing — instead of
  // fighting a hidden, atomic marker that renders zero-width but still occupies a real position.
  it('reveals bold markers when the cursor is inside the run', () => {
    // Caret between the two `*`s that open the marker, i.e. inside "**bold**"'s range.
    const state = createState('a **bold** b', { anchor: 5 });
    const decorations = decorationsIn(state, STYLES);

    expect(isHidden(decorations, 2, 4)).toBe(false);
    expect(isHidden(decorations, 8, 10)).toBe(false);
    expect(hasClass(decorations, 4, 8, STYLES.bold)).toBe(true);
  });

  it('reveals italic markers when the cursor is inside the run', () => {
    const state = createState('a *italic* b', { anchor: 5 });
    const decorations = decorationsIn(state, STYLES);

    expect(isHidden(decorations, 2, 3)).toBe(false);
    expect(isHidden(decorations, 9, 10)).toBe(false);
  });

  it('hides the heading marker and its trailing space, and styles the whole line, regardless of the cursor', () => {
    const state = createState('# Heading', { anchor: 3 }); // caret inside "Heading" itself
    const decorations = decorationsIn(state, STYLES);

    // "# " (marker plus the space after it) is hidden; "Heading" is left alone.
    expect(isHidden(decorations, 0, 2)).toBe(true);
    expect(decorations.some((d) => d.class?.includes(STYLES.heading1) && d.from === 0)).toBe(true);
  });

  it('keeps the blockquote marker hidden even when the cursor is inside it', () => {
    const state = createState('> quoted', { anchor: 4 });
    const decorations = decorationsIn(state, STYLES);

    expect(isHidden(decorations, 0, 2)).toBe(true); // `> `
  });

  it('never hides list markers, even when the cursor is elsewhere', () => {
    const state = createState('- one\n- two', { anchor: 11 }); // caret at the end of the doc
    const decorations = decorationsIn(state, STYLES);

    expect(isHidden(decorations, 0, 2)).toBe(false);
    expect(isHidden(decorations, 6, 8)).toBe(false);
  });

  it('hides link brackets, parens and the URL, styling only the link text', () => {
    const state = createState('[grafana](https://grafana.com)', { anchor: 30 }); // caret at the end of the doc
    const decorations = decorationsIn(state, STYLES);

    expect(hasClass(decorations, 1, 8, STYLES.link)).toBe(true);
    expect(isHidden(decorations, 0, 1)).toBe(true); // `[`
    expect(isHidden(decorations, 8, 9)).toBe(true); // `]`
    expect(isHidden(decorations, 9, 10)).toBe(true); // `(`
    expect(isHidden(decorations, 29, 30)).toBe(true); // `)`
    expect(isHidden(decorations, 10, 29)).toBe(true); // the URL itself
  });

  it('reveals link markup when the cursor is inside the link', () => {
    const state = createState('[grafana](https://grafana.com)', { anchor: 4 }); // inside "grafana"
    const decorations = decorationsIn(state, STYLES);

    expect(isHidden(decorations, 0, 1)).toBe(false); // `[`
    expect(isHidden(decorations, 9, 10)).toBe(false); // `(`
  });

  describe('atomic ranges (hidden)', () => {
    it('mirrors every hidden marker, so the cursor cannot land inside one', () => {
      const state = createState('a **bold** b');
      const hidden = hiddenRangesIn(state, STYLES);

      expect(isHidden(hidden, 2, 4)).toBe(true);
      expect(isHidden(hidden, 8, 10)).toBe(true);
    });

    it('excludes styled (non-hidden) ranges, so normal text inside a bold run stays navigable', () => {
      const state = createState('a **bold** b');
      const hidden = hiddenRangesIn(state, STYLES);

      expect(hidden.some((d) => d.class === STYLES.bold)).toBe(false);
    });

    it('excludes a revealed link’s markup, since it is not hidden while the cursor is inside it', () => {
      const state = createState('[grafana](https://grafana.com)', { anchor: 4 });
      const hidden = hiddenRangesIn(state, STYLES);

      expect(hidden).toHaveLength(0);
    });
  });

  it('hides strikethrough markers and styles the content, same as bold', () => {
    const state = createState('a ~~strike~~ b', { anchor: 0 });
    const decorations = decorationsIn(state, STYLES);

    // "~~strike~~" spans [2, 12); the markers are the first and last two characters.
    expect(isHidden(decorations, 2, 4)).toBe(true);
    expect(isHidden(decorations, 10, 12)).toBe(true);
    expect(hasClass(decorations, 4, 10, STYLES.strikethrough)).toBe(true);
  });
});

describe('enclosingListKind', () => {
  it('identifies a bulleted list', () => {
    const state = createState('- one\n- two');

    expect(enclosingListKind(syntaxTree(state), 2)).toBe('bullet');
  });

  it('identifies an ordered list', () => {
    const state = createState('1. one\n2. two');

    expect(enclosingListKind(syntaxTree(state), 3)).toBe('ordered');
  });

  it('finds nothing outside a list', () => {
    const state = createState('plain text');

    expect(enclosingListKind(syntaxTree(state), 3)).toBeUndefined();
  });
});
