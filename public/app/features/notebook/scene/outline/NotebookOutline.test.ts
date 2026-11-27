import { EditorView } from '@codemirror/view';

import { NOTEBOOK_CELL_KEY_ATTRIBUTE } from '../layout-notebook/edit/cellClassNames';

import { scrollToNotebookEntry } from './NotebookOutline';

describe('scrollToNotebookEntry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  // A cell being edited is a CodeMirror document that only draws the lines near the viewport, so the
  // jump goes through the editor; NotebookScenePage's test covers the rendered (read-mode) cell.
  it('scrolls the page to an editing cell heading line, below the sticky chrome', () => {
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    const scrollIntoView = jest.spyOn(HTMLElement.prototype, 'scrollIntoView');
    const frame = document.createElement('div');
    frame.setAttribute(NOTEBOOK_CELL_KEY_ATTRIBUTE, 'findings');
    document.body.append(frame);
    const view = new EditorView({ doc: '# Findings\n\nProse.\n\n## Follow-ups', parent: frame });
    const dispatch = jest.spyOn(view, 'dispatch');

    scrollToNotebookEntry(
      {
        id: 'findings:heading-1',
        cellKey: 'findings',
        kind: 'heading',
        label: 'Follow-ups',
        depth: 1,
        heading: { line: 4, occurrence: 0 },
      },
      120
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
    const [spec] = dispatch.mock.calls[0];
    const effects = 'effects' in spec ? spec.effects : undefined;
    const effect = Array.isArray(effects) ? effects[0] : effects;
    // The scroll effect's value is CodeMirror's ScrollTarget: the range to reveal and the margin above it.
    // Line 5 ("## Follow-ups") starts at offset 20.
    expect(effect?.value.range.from).toBe(20);
    // CodeMirror caps its margin at the editor's height, so it only draws the line; the page does the offset.
    expect(effect?.value.yMargin).toBe(0);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    const line = scrollIntoView.mock.contexts[0];
    expect(line).toBeInstanceOf(HTMLElement);
    expect((line as HTMLElement).classList.contains('cm-line')).toBe(true);
    expect((line as HTMLElement).textContent).toBe('## Follow-ups');
    expect((line as HTMLElement).style.scrollMarginTop).toBe('120px');
    view.destroy();
  });
});
