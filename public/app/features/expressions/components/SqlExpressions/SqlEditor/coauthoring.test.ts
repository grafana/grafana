import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import {
  type QueryCoauthoringEditorHandle,
  type QueryCoauthoringEditorHost,
} from 'app/features/dashboard-scene/panel-edit/PanelEditNext/QueryEditor/coauthoring/queryCoauthoringContracts';

import { coauthoringExtensions } from './coauthoring';

it('uses real CodeMirror selections, marks, props-style transactions, typing and disposal', async () => {
  let handle: QueryCoauthoringEditorHandle | undefined;
  const stop = jest.fn();
  const host: QueryCoauthoringEditorHost = {
    version: 1,
    register: (next) => {
      handle = next;
      return stop;
    },
    invoke: jest.fn(),
  };
  const parent = document.createElement('div');
  document.body.append(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({ doc: 'SELECT *\nFROM A', extensions: coauthoringExtensions(host, 'rgb(0, 100, 0)') }),
  });
  try {
    if (!handle) {
      throw new Error('Expected registered SQL editor');
    }
    view.dispatch({ selection: EditorSelection.range(0, 6) });
    expect(handle.getSelection()?.ranges).toEqual([{ from: 0, to: 6 }]);
    expect(handle.getSelection()?.anchor === view.scrollDOM).toBe(true);
    const selection = jest.fn();
    const unsubscribe = handle.subscribe(selection);
    view.dispatch({ selection: EditorSelection.cursor(1) });
    expect(selection).toHaveBeenCalledTimes(1);
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: '.', ctrlKey: true, bubbles: true }));
    expect(host.invoke).toHaveBeenCalledTimes(1);
    const changes = [
      {
        original: 'SELECT *\nFROM A',
        proposed: 'SELECT *\nFROM B',
        originalRanges: [{ from: 9, to: 15 }],
        proposedRanges: [{ from: 9, to: 15 }],
      },
    ];
    handle.showChanges?.(changes);
    await Promise.resolve();
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: changes[0].proposed } });
    expect(view.dom.querySelectorAll('.cm-line[style]')).toHaveLength(1);
    handle.showChanges?.(null);
    await Promise.resolve();
    expect(view.dom.querySelectorAll('.cm-line[style]')).toHaveLength(0);
    handle.showChanges?.(changes);
    await Promise.resolve();
    view.dispatch({ changes: { from: view.state.doc.length, insert: 'X' } });
    expect(view.dom.querySelectorAll('.cm-line[style]')).toHaveLength(0);
    unsubscribe();
  } finally {
    view.destroy();
    parent.remove();
  }
  expect(stop).toHaveBeenCalledTimes(1);
});
