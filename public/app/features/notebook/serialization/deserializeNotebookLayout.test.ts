import {
  type CellKind,
  defaultLibraryPanelKind,
  defaultPanelKind,
  type NotebookElement,
  type NotebookLayoutKind,
} from 'app/features/notebook/types';

import { deserializeNotebookLayout } from './deserializeNotebookLayout';

function markdownCell(text: string): CellKind {
  return { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text } } } };
}

function codeCell(language: string, code: string): CellKind {
  return { kind: 'Cell', spec: { content: { kind: 'Code', spec: { language, code } } } };
}

function fixture() {
  const elements: Record<string, NotebookElement> = {
    panel1: defaultPanelKind(),
    md1: markdownCell('# Notes'),
    code1: codeCell('sql', 'SELECT 1'),
    lib1: defaultLibraryPanelKind(),
  };

  const layout: NotebookLayoutKind = {
    kind: 'NotebookLayout',
    spec: {
      cells: [
        // collapsed omitted on panel1 to prove it round-trips as omitted, not false.
        { kind: 'NotebookLayoutItem', spec: { element: { kind: 'ElementReference', name: 'panel1' }, source: 'user' } },
        {
          kind: 'NotebookLayoutItem',
          spec: { element: { kind: 'ElementReference', name: 'md1' }, source: 'assistant', collapsed: true },
        },
        {
          kind: 'NotebookLayoutItem',
          spec: { element: { kind: 'ElementReference', name: 'code1' }, source: 'user', collapsed: false },
        },
        { kind: 'NotebookLayoutItem', spec: { element: { kind: 'ElementReference', name: 'lib1' }, source: 'user' } },
      ],
    },
  };

  return { layout, elements };
}

describe('deserializeNotebookLayout', () => {
  it('exposes only panel and library-panel cells as viz panels', () => {
    const { layout, elements } = fixture();

    const manager = deserializeNotebookLayout(layout, elements);

    // 4 cells in; the panel and library-panel are viz panels, markdown/code are narrative.
    expect(manager.state.cells).toHaveLength(4);
    expect(manager.getVizPanels()).toHaveLength(2);
  });

  it('round-trips cell order, source and collapsed', () => {
    const { layout, elements } = fixture();

    const manager = deserializeNotebookLayout(layout, elements);
    const roundTripped = manager.serialize();

    expect(roundTripped).toEqual(layout);
  });

  it('surfaces the notebook title and tags on the layout manager for the document header', () => {
    const { layout, elements } = fixture();

    const manager = deserializeNotebookLayout(layout, elements, { title: 'My notebook', tags: ['incident'] });

    expect(manager.state.title).toBe('My notebook');
    expect(manager.state.tags).toEqual(['incident']);
  });
});
