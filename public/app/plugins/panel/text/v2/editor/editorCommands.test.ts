import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { createTheme } from '@grafana/data';
import { markdownLivePreview } from '@grafana/ui/unstable';

import { insertAtCursor, toggleLinePrefix, toggleOrderedList, toggleSurround } from './editorCommands';

let views: EditorView[] = [];

function createView(
  doc: string,
  selection?: { anchor: number; head?: number },
  extensions: Extension[] = []
): EditorView {
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc, selection, extensions }),
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

  it('leaves out the line a selection merely ends at the start of', () => {
    const view = createView('one\ntwo', { anchor: 0, head: 4 });

    toggleLinePrefix(view, '- ');

    expect(view.state.doc.toString()).toBe('- one\ntwo');
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

    expect(view.state.doc.toString()).toBe('- one\n- two');
  });

  it('replaces a checklist marker instead of leaving the checkbox behind', () => {
    const view = createView('- [ ] task', { anchor: 8 });

    toggleLinePrefix(view, '- ');

    expect(view.state.doc.toString()).toBe('- task');
  });

  it('replaces a bullet marker when turning the line into a checklist', () => {
    const view = createView('- task', { anchor: 4 });

    toggleLinePrefix(view, '- [ ] ');

    expect(view.state.doc.toString()).toBe('- [ ] task');
  });

  it('replaces a numbered marker when switching list style', () => {
    const view = createView('1. task', { anchor: 5 });

    toggleLinePrefix(view, '- ');

    expect(view.state.doc.toString()).toBe('- task');
  });

  it('converts every selected line to the new list style', () => {
    const view = createView('- [ ] one\n1. two\nthree', { anchor: 0, head: 22 });

    toggleLinePrefix(view, '- ');

    expect(view.state.doc.toString()).toBe('- one\n- two\n- three');
  });

  it('strips a heading of any level', () => {
    const view = createView('### title', { anchor: 6 });

    toggleLinePrefix(view, '# ');

    expect(view.state.doc.toString()).toBe('title');
  });

  it('strips a checked checklist item', () => {
    const view = createView('- [x] task', { anchor: 8 });

    toggleLinePrefix(view, '- [ ] ');

    expect(view.state.doc.toString()).toBe('task');
  });

  it('strips a multi-digit numbered marker whole', () => {
    const view = createView('10. task', { anchor: 6 });

    toggleLinePrefix(view, '1. ');

    expect(view.state.doc.toString()).toBe('task');
  });

  it('leaves text that only looks like a marker alone', () => {
    const view = createView('-task', { anchor: 3 });

    toggleLinePrefix(view, '- ');

    expect(view.state.doc.toString()).toBe('- -task');
  });

  it('keeps the caret in the text when the marker length changes', () => {
    const view = createView('- [ ] task', { anchor: 8 });

    toggleLinePrefix(view, '- ');

    // Still between `ta` and `sk`.
    expect(view.state.selection.main.head).toBe(4);
  });
});

describe('toggleOrderedList', () => {
  it('numbers the selected lines in sequence', () => {
    const view = createView('one\ntwo\nthree', { anchor: 0, head: 13 });

    toggleOrderedList(view);

    expect(view.state.doc.toString()).toBe('1. one\n2. two\n3. three');
  });

  it('numbers the caret line on its own', () => {
    const view = createView('one', { anchor: 0 });

    toggleOrderedList(view);

    expect(view.state.doc.toString()).toBe('1. one');
  });

  it('continues the numbering of an item directly above', () => {
    const view = createView('1. one\ntwo\nthree', { anchor: 7, head: 16 });

    toggleOrderedList(view);

    expect(view.state.doc.toString()).toBe('1. one\n2. two\n3. three');
  });

  it('keeps the start number of the list it extends', () => {
    const view = createView('5. five\nsix', { anchor: 8 });

    toggleOrderedList(view);

    expect(view.state.doc.toString()).toBe('5. five\n6. six');
  });

  it('renumbers items below so the source counts up the way the preview does', () => {
    const view = createView('one\n1. a\n1. b', { anchor: 0 });

    toggleOrderedList(view);

    expect(view.state.doc.toString()).toBe('1. one\n2. a\n3. b');
  });

  it('repairs numbering that already drifted out of sequence', () => {
    const view = createView('1. a\n9. b\nc', { anchor: 10 });

    toggleOrderedList(view);

    expect(view.state.doc.toString()).toBe('1. a\n2. b\n3. c');
  });

  it('stops at a blank line rather than renumbering the next block', () => {
    const view = createView('one\n\n1. a\n2. b', { anchor: 0 });

    toggleOrderedList(view);

    expect(view.state.doc.toString()).toBe('1. one\n\n1. a\n2. b');
  });

  it('replaces other list markers on the selected lines', () => {
    const view = createView('- one\n- [ ] two', { anchor: 0, head: 15 });

    toggleOrderedList(view);

    expect(view.state.doc.toString()).toBe('1. one\n2. two');
  });

  it('completes a partially numbered selection instead of clearing it', () => {
    const view = createView('1. one\ntwo', { anchor: 0, head: 10 });

    toggleOrderedList(view);

    expect(view.state.doc.toString()).toBe('1. one\n2. two');
  });

  it('clears the markers when every selected line is numbered', () => {
    const view = createView('1. one\n2. two', { anchor: 0, head: 13 });

    toggleOrderedList(view);

    expect(view.state.doc.toString()).toBe('one\ntwo');
  });

  it('clears a multi-digit marker whole', () => {
    const view = createView('10. task', { anchor: 6 });

    toggleOrderedList(view);

    expect(view.state.doc.toString()).toBe('task');
  });

  it('leaves out the line a selection merely ends at the start of', () => {
    const view = createView('one\ntwo', { anchor: 0, head: 4 });

    toggleOrderedList(view);

    expect(view.state.doc.toString()).toBe('1. one\ntwo');
  });

  it('keeps the caret in the text when the marker length changes', () => {
    const view = createView('- [ ] task', { anchor: 8 });

    toggleOrderedList(view);

    // Still between `ta` and `sk`.
    expect(view.state.doc.toString()).toBe('1. task');
    expect(view.state.selection.main.head).toBe(5);
  });
});

// The toolbar edits markdown source, and live preview only decorates the view,
// so every command must behave identically with it installed.
describe('with markdown live preview installed', () => {
  const createPreviewView = (doc: string, selection?: { anchor: number; head?: number }) =>
    createView(doc, selection, [markdown({ base: markdownLanguage }), markdownLivePreview(createTheme())]);

  it('wraps a selection whose markers are hidden', () => {
    const view = createPreviewView('hello world', { anchor: 0, head: 5 });

    toggleSurround(view, '**');

    expect(view.state.doc.toString()).toBe('**hello** world');
  });

  it('unwraps a selection whose markers are hidden', () => {
    const view = createPreviewView('**hello** world', { anchor: 2, head: 7 });

    toggleSurround(view, '**');

    expect(view.state.doc.toString()).toBe('hello world');
  });

  it('toggles a heading prefix off a rendered heading', () => {
    const view = createPreviewView('# Title', { anchor: 4 });

    toggleLinePrefix(view, '# ');

    expect(view.state.doc.toString()).toBe('Title');
  });
});
