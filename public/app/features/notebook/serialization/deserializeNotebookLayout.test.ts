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

  it('skips a cell named after an inherited member instead of throwing', () => {
    const { layout, elements } = fixture();
    // `elements` is caller-supplied JSON, so a cell can name anything. A bare bracket lookup resolves
    // `constructor` to Object's own, which is truthy and has no `kind`, so it would reach the
    // unknown-kind throw rather than the skip every other unresolvable reference takes.
    layout.spec.cells.push({
      kind: 'NotebookLayoutItem',
      spec: { element: { kind: 'ElementReference', name: 'constructor' }, source: 'user' },
    });

    const manager = deserializeNotebookLayout(layout, elements);

    expect(manager.state.cells).toHaveLength(4);
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

  describe('panel ids', () => {
    it('keys panels off their element id when no generator is given', () => {
      const { layout, elements } = fixture();
      elements.panel1 = { ...defaultPanelKind(), spec: { ...defaultPanelKind().spec, id: 7 } };

      const manager = deserializeNotebookLayout(layout, elements);

      expect(manager.getVizPanels()[0].state.key).toBe('panel-7');
    });

    // Two elements carrying the same id is what the generator exists for: without it both panels get
    // the same key, and findVizPanelByKey plus the panelId enrichDataRequest sends cannot tell them
    // apart. Nothing validates uniqueness at load, same as the dashboard.
    it('reassigns keys from the generator when one is given', () => {
      const { layout, elements } = fixture();
      elements.panel1 = { ...defaultPanelKind(), spec: { ...defaultPanelKind().spec, id: 3 } };
      elements.lib1 = { ...defaultLibraryPanelKind(), spec: { ...defaultLibraryPanelKind().spec, id: 3 } };

      const collided = deserializeNotebookLayout(layout, elements).getVizPanels();
      expect(collided.map((panel) => panel.state.key)).toEqual(['panel-3', 'panel-3']);

      let next = 10;
      const manager = deserializeNotebookLayout(layout, elements, undefined, () => next++);

      expect(manager.getVizPanels().map((panel) => panel.state.key)).toEqual(['panel-10', 'panel-11']);
    });
  });
});
