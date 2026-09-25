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

  it("reads a panel cell's own time range off its queryOptions, and leaves the layout untouched", () => {
    const { layout, elements } = fixture();
    const panelElement = elements.panel1;
    if (panelElement.kind === 'Panel') {
      panelElement.spec.data.spec.queryOptions = { timeFrom: 'now-24h', timeTo: 'now' };
    }

    const manager = deserializeNotebookLayout(layout, elements);
    const panelCell = manager.state.cells[0];

    expect(panelCell.state.$timeRange?.state.from).toBe('now-24h');
    expect(panelCell.state.$timeRange?.state.to).toBe('now');
    // The layout item itself never carries this — see transformNotebook.test.ts for the actual
    // round-trip through queryOptions.timeFrom/.timeTo on the panel element.
    expect(manager.serialize()).toEqual(layout);
  });

  // Confirms timeFrom/timeTo are stripped before buildVizPanelState runs: otherwise it would
  // auto-attach its own PanelTimeRange here, which would shadow this cell-level override via
  // sceneGraph.getTimeRange's check-self-before-parent resolution order.
  it('does not let buildVizPanelState attach its own PanelTimeRange from the same fields', () => {
    const { layout, elements } = fixture();
    const panelElement = elements.panel1;
    if (panelElement.kind === 'Panel') {
      panelElement.spec.data.spec.queryOptions = { timeFrom: 'now-24h', timeTo: 'now' };
    }

    const manager = deserializeNotebookLayout(layout, elements);
    const panelCell = manager.state.cells[0];

    expect(panelCell.state.body?.state.$timeRange).toBeUndefined();
  });

  // A one-sided override (only timeFrom, e.g. a dashboard-style relative shift) isn't a cell
  // range — it must reach buildVizPanelState untouched instead of being blanked, or a common
  // dashboard panel shape would silently lose its override the moment it opens in a notebook.
  it('leaves a one-sided panel time override untouched for buildVizPanelState', () => {
    const { layout, elements } = fixture();
    const panelElement = elements.panel1;
    if (panelElement.kind === 'Panel') {
      panelElement.spec.data.spec.queryOptions = { timeFrom: '2h' };
    }

    const manager = deserializeNotebookLayout(layout, elements);
    const panelCell = manager.state.cells[0];

    expect(panelCell.state.$timeRange).toBeUndefined();
    // buildVizPanelState saw the original timeFrom and attached its own PanelTimeRange for it.
    expect(panelCell.state.body?.state.$timeRange).toBeDefined();
  });

  it('leaves a panel cell with no saved time range without one', () => {
    const { layout, elements } = fixture();

    const manager = deserializeNotebookLayout(layout, elements);
    const panelCell = manager.state.cells[0];

    expect(panelCell.state.$timeRange).toBeUndefined();
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
