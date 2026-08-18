import { markdown } from '@codemirror/lang-markdown';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { EditorSelection, EditorState } from '@codemirror/state';

import {
  BOLD_NODE,
  buildDecorations,
  findEnclosingMarkNode,
  INLINE_CODE_NODE,
  ITALIC_NODE,
  LINK_NODE,
  overlapsSelection,
  type MarkdownEditorStyles,
} from './markdownLivePreview';

// CodeMirror's own state/parsing layer (unlike the React-wrapped, lazily loaded editor component) runs
// fine outside a browser, so the syntax-tree-driven logic here is tested directly against a real
// EditorState rather than through a jsdom-mocked textarea.
function createState(doc: string, selection?: { anchor: number; head?: number }) {
  const state = EditorState.create({
    doc,
    selection: selection ? EditorSelection.single(selection.anchor, selection.head ?? selection.anchor) : undefined,
    extensions: [markdown()],
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
  link: 'link',
  blockquoteLine: 'blockquote-line',
  listItemLine: 'list-item-line',
};

/** Every decoration in the set as a plain, order-independent, easy-to-assert-on record. */
function decorationsIn(state: EditorState, styles: MarkdownEditorStyles) {
  const decorations = buildDecorations(state, styles);
  const out: Array<{ from: number; to: number; class?: string; hidden: boolean }> = [];

  decorations.between(0, state.doc.length, (from, to, deco) => {
    const spec = deco.spec as { class?: string };
    out.push({ from, to, class: spec.class, hidden: spec.class === undefined });
  });

  return out;
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

  it('reveals bold markers when the cursor is inside the run', () => {
    // Caret between the two `*`s that open the marker, i.e. inside "**bold**"'s range.
    const state = createState('a **bold** b', { anchor: 5 });
    const decorations = decorationsIn(state, STYLES);

    expect(isHidden(decorations, 2, 4)).toBe(false);
    expect(isHidden(decorations, 8, 10)).toBe(false);
    // The style still applies while revealed — matches Obsidian, per the design.
    expect(hasClass(decorations, 4, 8, STYLES.bold)).toBe(true);
  });

  it('hides the heading marker and its trailing space, and styles the whole line', () => {
    const state = createState('# Heading', { anchor: 9 }); // caret at the end of the doc, outside the heading
    const decorations = decorationsIn(state, STYLES);

    // "# " (marker plus the space after it) is hidden; "Heading" is left alone.
    expect(isHidden(decorations, 0, 2)).toBe(true);
    expect(decorations.some((d) => d.class?.includes(STYLES.heading1) && d.from === 0)).toBe(true);
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
});
