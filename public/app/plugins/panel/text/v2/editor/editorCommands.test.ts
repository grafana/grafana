import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { insertAtCursor, toggleLinePrefix, toggleSurround } from './editorCommands';

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

describe('toggleSurround', () => {
  it('wraps the selection and keeps it selected', () => {
    const view = createView('hello world', { anchor: 0, head: 5 });

    toggleSurround(view, '**');

    expect(view.state.doc.toString()).toBe('**hello** world');
    const { from, to } = view.state.selection.main;
    expect(view.state.sliceDoc(from, to)).toBe('hello');
  });

  it('places the caret between the markers when nothing is selected', () => {
    const view = createView('', { anchor: 0 });

    toggleSurround(view, '**');

    expect(view.state.doc.toString()).toBe('****');
    expect(view.state.selection.main.head).toBe(2);
  });

  it('supports asymmetric markers', () => {
    const view = createView('Grafana', { anchor: 0, head: 7 });

    toggleSurround(view, '[', '](https://)');

    expect(view.state.doc.toString()).toBe('[Grafana](https://)');
  });

  it('strips the markers when they surround the selection', () => {
    const view = createView('**hello** world', { anchor: 2, head: 7 });

    toggleSurround(view, '**');

    expect(view.state.doc.toString()).toBe('hello world');
    const { from, to } = view.state.selection.main;
    expect(view.state.sliceDoc(from, to)).toBe('hello');
  });

  it('strips the markers when they are part of the selection', () => {
    const view = createView('**hello** world', { anchor: 0, head: 9 });

    toggleSurround(view, '**');

    expect(view.state.doc.toString()).toBe('hello world');
    const { from, to } = view.state.selection.main;
    expect(view.state.sliceDoc(from, to)).toBe('hello');
  });

  it('strips asymmetric markers', () => {
    const view = createView('[Grafana](https://)', { anchor: 1, head: 8 });

    toggleSurround(view, '[', '](https://)');

    expect(view.state.doc.toString()).toBe('Grafana');
  });

  it('removes an empty marker pair the caret sits in', () => {
    const view = createView('****', { anchor: 2 });

    toggleSurround(view, '**');

    expect(view.state.doc.toString()).toBe('');
  });

  it('nests italic inside bold instead of breaking up the bold markers', () => {
    const view = createView('**hello**', { anchor: 2, head: 7 });

    toggleSurround(view, '*');

    expect(view.state.doc.toString()).toBe('***hello***');
  });

  it('nests italic when the whole bold span is selected', () => {
    const view = createView('**hello**', { anchor: 0, head: 9 });

    toggleSurround(view, '*');

    expect(view.state.doc.toString()).toBe('***hello***');
  });

  it('adds markers when only one side is already marked', () => {
    const view = createView('**hello', { anchor: 2, head: 7 });

    toggleSurround(view, '**');

    expect(view.state.doc.toString()).toBe('****hello**');
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

describe('toggleLinePrefix', () => {
  it('prefixes the caret line', () => {
    const view = createView('one\ntwo', { anchor: 5 });

    toggleLinePrefix(view, '- ');

    expect(view.state.doc.toString()).toBe('one\n- two');
  });

  it('prefixes every line touched by the selection', () => {
    const view = createView('one\ntwo\nthree', { anchor: 0, head: 7 });

    toggleLinePrefix(view, '# ');

    expect(view.state.doc.toString()).toBe('# one\n# two\nthree');
  });

  it('keeps the caret after the inserted prefix', () => {
    const view = createView('one', { anchor: 0 });

    toggleLinePrefix(view, '- [ ] ');

    expect(view.state.doc.toString()).toBe('- [ ] one');
    expect(view.state.selection.main.head).toBe(6);
  });

  it('strips the prefix when the caret line already has it', () => {
    const view = createView('one\n- two', { anchor: 7 });

    toggleLinePrefix(view, '- ');

    expect(view.state.doc.toString()).toBe('one\ntwo');
  });

  it('strips the prefix from every selected line when they all have it', () => {
    const view = createView('# one\n# two', { anchor: 0, head: 11 });

    toggleLinePrefix(view, '# ');

    expect(view.state.doc.toString()).toBe('one\ntwo');
  });

  it('completes a partially prefixed selection instead of stripping it', () => {
    const view = createView('- one\ntwo', { anchor: 0, head: 9 });

    toggleLinePrefix(view, '- ');

    expect(view.state.doc.toString()).toBe('- - one\n- two');
  });
});
