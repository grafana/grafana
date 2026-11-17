import { EditorView } from '@codemirror/view';

import { NOTEBOOK_CELL_KEY_ATTRIBUTE } from '../layout-notebook/edit/cellClassNames';

import { scrollToNotebookEntry } from './NotebookOutline';

describe('scrollToNotebookEntry', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // A cell being edited is a CodeMirror document that only draws the lines near the viewport, so the
  // jump goes through the editor; NotebookScenePage's test covers the rendered (read-mode) cell.
  it('scrolls an editing cell to the heading line, below the sticky chrome', () => {
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
    expect(effect?.value.yMargin).toBe(120);
    view.destroy();
  });
});
