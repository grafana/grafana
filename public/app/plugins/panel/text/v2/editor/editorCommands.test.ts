import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { insertAtCursor, prefixSelectedLines, surroundSelection } from './editorCommands';

let views: EditorView[] = [];

function createView(doc: string, selection?: { anchor: number; head?: number }): EditorView {
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc, selection }),
  });
  views.push(view);
  return view;
}

afterEach(() => {
  views.forEach((view) => view.destroy());
  views = [];
});

describe('surroundSelection', () => {
  it('wraps the selection and keeps it selected', () => {
    const view = createView('hello world', { anchor: 0, head: 5 });

    surroundSelection(view, '**');

    expect(view.state.doc.toString()).toBe('**hello** world');
    const { from, to } = view.state.selection.main;
    expect(view.state.sliceDoc(from, to)).toBe('hello');
  });

  it('places the caret between the markers when nothing is selected', () => {
    const view = createView('', { anchor: 0 });

    surroundSelection(view, '**');

    expect(view.state.doc.toString()).toBe('****');
    expect(view.state.selection.main.head).toBe(2);
  });

  it('supports asymmetric markers', () => {
    const view = createView('Grafana', { anchor: 0, head: 7 });

    surroundSelection(view, '[', '](https://)');

    expect(view.state.doc.toString()).toBe('[Grafana](https://)');
  });
});

describe('insertAtCursor', () => {
  it('inserts at the caret and moves it past the insertion', () => {
    const view = createView('ab', { anchor: 1 });

    insertAtCursor(view, '${}');

    expect(view.state.doc.toString()).toBe('a${}b');
    expect(view.state.selection.main.head).toBe(4);
  });

  it('replaces the selection', () => {
    const view = createView('keep drop', { anchor: 5, head: 9 });

    insertAtCursor(view, 'new');

    expect(view.state.doc.toString()).toBe('keep new');
  });
});

describe('prefixSelectedLines', () => {
  it('prefixes the caret line', () => {
    const view = createView('one\ntwo', { anchor: 5 });

    prefixSelectedLines(view, '- ');

    expect(view.state.doc.toString()).toBe('one\n- two');
  });

  it('prefixes every line touched by the selection', () => {
    const view = createView('one\ntwo\nthree', { anchor: 0, head: 7 });

    prefixSelectedLines(view, '# ');

    expect(view.state.doc.toString()).toBe('# one\n# two\nthree');
  });

  it('leaves out the line a selection merely ends at the start of', () => {
    const view = createView('one\ntwo', { anchor: 0, head: 4 });

    prefixSelectedLines(view, '- ');

    expect(view.state.doc.toString()).toBe('- one\ntwo');
  });

  it('keeps the caret after the inserted prefix', () => {
    const view = createView('one', { anchor: 0 });

    prefixSelectedLines(view, '- [ ] ');

    expect(view.state.doc.toString()).toBe('- [ ] one');
    expect(view.state.selection.main.head).toBe(6);
  });
});
