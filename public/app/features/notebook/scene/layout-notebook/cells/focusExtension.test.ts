import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { navigationKeymap } from './focusExtension';

// CodeMirror's own state/view layer (unlike the React-wrapped, lazily loaded editor component) runs
// fine outside a browser, so navigationKeymap's boundary detection is tested directly against a real
// EditorView rather than through a jsdom-mocked textarea — see markdownLivePreview.test.ts for the
// same rationale applied to the syntax-tree-driven logic in this same directory.
function createView(doc: string, pos: number, selectionEnd = pos) {
  const onNavigate = jest.fn();
  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.range(pos, selectionEnd),
      extensions: [navigationKeymap(onNavigate)],
    }),
    parent: document.createElement('div'),
  });
  return { view, onNavigate };
}

function pressKey(view: EditorView, key: string) {
  view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('navigationKeymap', () => {
  it('reports up once the caret is already on the first line', () => {
    const { view, onNavigate } = createView('one\ntwo\nthree', 0);

    pressKey(view, 'ArrowUp');

    expect(onNavigate).toHaveBeenCalledWith('up');
  });

  it('does not report up while a line above still exists', () => {
    const { view, onNavigate } = createView('one\ntwo\nthree', 5); // inside "two"

    pressKey(view, 'ArrowUp');

    expect(onNavigate).not.toHaveBeenCalled();
  });

  // The absolute end of the document, not just anywhere on its last line: jsdom reports every line
  // as zero-height, so moveVertically's real pixel-geometry clamping at an *interior* point on the
  // last line isn't something a jsdom test can faithfully reproduce — only the unambiguous "nothing
  // at all comes after this position" case is. The middle-of-the-last-line case is covered by this
  // plan's own manual verification step instead.
  it('reports down once the caret is already at the end of the document', () => {
    const { view, onNavigate } = createView('one\ntwo\nthree', 13);

    pressKey(view, 'ArrowDown');

    expect(onNavigate).toHaveBeenCalledWith('down');
  });

  it('does not report down while a line below still exists', () => {
    const { view, onNavigate } = createView('one\ntwo\nthree', 0);

    pressKey(view, 'ArrowDown');

    expect(onNavigate).not.toHaveBeenCalled();
  });

  // Matches how a real text editor behaves: an arrow key collapses a selection first, rather than
  // discarding it by jumping straight to a different cell.
  it('leaves a non-empty selection alone rather than jumping cells', () => {
    const { view, onNavigate } = createView('one', 0, 3);

    pressKey(view, 'ArrowUp');
    pressKey(view, 'ArrowDown');

    expect(onNavigate).not.toHaveBeenCalled();
  });
});
