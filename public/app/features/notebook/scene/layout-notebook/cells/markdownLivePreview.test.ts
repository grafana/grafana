import { history, undo } from '@codemirror/commands';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView, type DecorationSet } from '@codemirror/view';
import { fireEvent, within } from '@testing-library/dom';

import { createTheme } from '@grafana/data';

import {
  BOLD_NODE,
  buildDecorations,
  enclosingListKind,
  findEnclosingMarkNode,
  INLINE_CODE_NODE,
  ITALIC_NODE,
  LINK_NODE,
  markdownLanguageSupport,
  markdownLivePreview,
  nextListContinuation,
  toggleChecklist,
  toggleBulletedList,
  toggleInlineMark,
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
  heading5: 'h5',
  heading6: 'h6',
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

  it('styles h5 and h6 headings with their own classes', () => {
    const h5 = decorationsIn(createState('##### Heading 5'), STYLES);
    expect(h5.some((d) => d.class?.includes(STYLES.heading5) && d.from === 0)).toBe(true);

    const h6 = decorationsIn(createState('###### Heading 6'), STYLES);
    expect(h6.some((d) => d.class?.includes(STYLES.heading6) && d.from === 0)).toBe(true);
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

describe('checklists', () => {
  const views: EditorView[] = [];
  function createView(doc: string, selection?: { anchor: number; head?: number }) {
    const preview = markdownLivePreview(createTheme());
    const view = new EditorView({
      state: EditorState.create({ doc, selection, extensions: [preview.extensions, history()] }),
      parent: document.body.appendChild(document.createElement('div')),
    });
    views.push(view);
    return view;
  }

  afterEach(() => {
    for (const view of views.splice(0)) {
      const parent = view.dom.parentElement;
      view.destroy();
      parent?.remove();
    }
  });

  it.each(['- [ ] investigate', '- [x] investigate', '- [X] investigate'])(
    'continues %s with an unchecked item',
    (doc) => {
      const state = createState(doc);
      expect(enclosingListKind(syntaxTree(state), doc.length)).toBe('checklist');
      expect(nextListContinuation(state, doc.length)).toBe('- [ ] ');
      expect(hiddenRangesIn(state, STYLES)).toContainEqual({ from: 2, to: 5, hidden: true, class: undefined });
    }
  );

  it.each(['- [ ] ', '- [x] ', '- [X] '])('ends an empty checklist item %s', (doc) => {
    expect(nextListContinuation(createState(doc), doc.length)).toBeUndefined();
  });

  it('converts selected bullets and numbered items, preserves indentation and completed tasks', () => {
    const doc = '- first\n  2. second\n- [x] done\nlast';
    const view = createView(doc, { anchor: 0, head: doc.length });
    toggleChecklist(view);
    expect(view.state.doc.toString()).toBe('- [ ] first\n  - [ ] second\n- [x] done\n- [ ] last');
    toggleChecklist(view);
    expect(view.state.doc.toString()).toBe('first\n  second\ndone\nlast');
  });

  it('replaces heading markers when converting to a checklist', () => {
    const view = createView('# Heading\n### Subheading', { anchor: 0, head: 24 });
    toggleChecklist(view);
    expect(view.state.doc.toString()).toBe('- [ ] Heading\n- [ ] Subheading');
  });

  it('converts nested tasks to bullets and removes bullets without losing indentation', () => {
    const doc = '- [ ] Parent\n  - [x] Child';
    const view = createView(doc, { anchor: doc.indexOf('Child'), head: doc.length });
    toggleBulletedList(view);
    expect(view.state.doc.toString()).toBe('- [ ] Parent\n  - Child');
    toggleBulletedList(view);
    expect(view.state.doc.toString()).toBe('- [ ] Parent\n  Child');
  });

  it('does not convert the line at the exclusive end of a selection', () => {
    const view = createView('first\nsecond', { anchor: 0, head: 6 });
    toggleChecklist(view);
    expect(view.state.doc.toString()).toBe('- [ ] first\nsecond');
  });

  it('toggles the correct checkbox after text was inserted before its reused widget', () => {
    const view = createView('- [ ] first\n- [ ] second');
    const second = within(view.dom).getByRole('checkbox', { name: 'second' });
    view.dispatch({ changes: { from: 0, insert: 'Introduction\n\n' } });
    expect(within(view.dom).getByRole('checkbox', { name: 'second' })).toBe(second);
    fireEvent.click(second);
    expect(view.state.doc.toString()).toBe('Introduction\n\n- [ ] first\n- [x] second');
    expect(second).toBeChecked();
    fireEvent.click(second);
    expect(view.state.doc.toString()).toBe('Introduction\n\n- [ ] first\n- [ ] second');
  });

  it('records checkbox changes as undoable text edits', () => {
    const view = createView('- [ ] investigate');
    fireEvent.click(within(view.dom).getByRole('checkbox', { name: 'investigate' }));
    expect(view.state.doc.toString()).toBe('- [x] investigate');
    undo(view);
    expect(view.state.doc.toString()).toBe('- [ ] investigate');
    expect(within(view.dom).getByRole('checkbox', { name: 'investigate' })).not.toBeChecked();
  });
});

describe('toggleInlineMark', () => {
  const views: EditorView[] = [];
  function createView(doc: string, from = 0, to = from) {
    const preview = markdownLivePreview(createTheme());
    const view = new EditorView({
      state: EditorState.create({
        doc,
        selection: { anchor: from, head: to },
        extensions: [preview.extensions, history()],
      }),
      parent: document.body.appendChild(document.createElement('div')),
    });
    views.push(view);
    return view;
  }
  const selected = (view: EditorView) => {
    const { from, to } = view.state.selection.main;
    return view.state.sliceDoc(from, to);
  };

  afterEach(() => {
    for (const view of views.splice(0)) {
      const parent = view.dom.parentElement;
      view.destroy();
      parent?.remove();
    }
  });

  const boldSelections = [
    ['the leading delimiter', 0, 2],
    ['the trailing delimiter', 5, 7],
    ['the text only', 2, 5],
    ['the whole span', 0, 7],
  ] as const;

  it.each(boldSelections)('unbolds when only %s is selected', (_name, from, to) => {
    const view = createView('**foo**', from, to);

    toggleInlineMark(view, 'bold');

    expect(view.state.doc.toString()).toBe('foo');
    expect(selected(view)).toBe('foo');
  });

  it.each(boldSelections)('does not accumulate asterisks over repeated toggles of %s', (_name, from, to) => {
    const view = createView('**foo**', from, to);
    const docs: string[] = [];

    for (let i = 0; i < 4; i++) {
      toggleInlineMark(view, 'bold');
      docs.push(view.state.doc.toString());
    }

    expect(docs).toEqual(['foo', '**foo**', 'foo', '**foo**']);
  });

  it('bolds a selection that partly covers an existing span by merging into one span', () => {
    const view = createView('a **foo** b', 0, 5);

    toggleInlineMark(view, 'bold');

    expect(view.state.doc.toString()).toBe('**a foo** b');
  });

  it('merges several bold spans in a selection', () => {
    const doc = '**foo** bar **baz**';
    const view = createView(doc, 0, doc.length);

    toggleInlineMark(view, 'bold');

    expect(view.state.doc.toString()).toBe('**foo bar baz**');
  });

  it('unbolds the whole span for a partial text selection and keeps the selection', () => {
    const view = createView('**foo**', 2, 4);

    toggleInlineMark(view, 'bold');

    expect(view.state.doc.toString()).toBe('foo');
    expect(selected(view)).toBe('fo');
  });

  it('wraps plain text and keeps it selected', () => {
    const view = createView('foo', 0, 3);

    toggleInlineMark(view, 'bold');

    expect(view.state.doc.toString()).toBe('**foo**');
    expect(selected(view)).toBe('foo');
  });

  it('inserts an empty pair at a caret', () => {
    const view = createView('', 0);

    toggleInlineMark(view, 'bold');

    expect(view.state.doc.toString()).toBe('****');
    expect(view.state.selection.main.head).toBe(2);
  });

  describe('italic', () => {
    it('unitalicizes from the leading delimiter', () => {
      const view = createView('*foo*', 0, 1);

      toggleInlineMark(view, 'italic');

      expect(view.state.doc.toString()).toBe('foo');
    });

    it('adds italic around an existing bold span', () => {
      const view = createView('**foo**', 0, 2);

      toggleInlineMark(view, 'italic');

      expect(view.state.doc.toString()).toBe('***foo***');
    });

    it('removes bold and italic independently from bold-italic text', () => {
      const bold = createView('***foo***', 0, 9);
      toggleInlineMark(bold, 'bold');
      expect(bold.state.doc.toString()).toBe('*foo*');

      const italic = createView('***foo***', 0, 9);
      toggleInlineMark(italic, 'italic');
      expect(italic.state.doc.toString()).toBe('**foo**');
    });
  });

  it('alternates strikethrough from its delimiter', () => {
    const view = createView('~~foo~~', 0, 2);
    const docs: string[] = [];

    for (let i = 0; i < 3; i++) {
      toggleInlineMark(view, 'strikethrough');
      docs.push(view.state.doc.toString());
    }

    expect(docs).toEqual(['foo', '~~foo~~', 'foo']);
  });

  it('unwraps inline code from its backtick', () => {
    const view = createView('`foo`', 0, 1);

    toggleInlineMark(view, 'code');

    expect(view.state.doc.toString()).toBe('foo');
  });
});
