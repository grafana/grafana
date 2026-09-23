import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { LibraryPanelBehavior } from 'app/features/dashboard-scene/scene/LibraryPanelBehavior';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';
import * as libraryPanelsApi from 'app/features/library-panels/state/api';
import {
  type CellKind,
  defaultLibraryPanelKind,
  defaultPanelKind,
  type NotebookElement,
  type NotebookLayoutKind,
} from 'app/features/notebook/types';

import { deserializeNotebookLayout } from './deserializeNotebookLayout';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id })),
  getPanelPluginFromCache: () => undefined,
});

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

  // buildLibraryPanelState attaches a real LibraryPanelBehavior, the same core builder a dashboard
  // uses — this exercises the whole thing end to end (activate → fetch → resolved viz panel) rather
  // than just checking the shape it was built with.
  it("resolves a library-panel cell's real content on activation", async () => {
    const { layout, elements } = fixture();
    elements.lib1 = {
      kind: 'LibraryPanel',
      spec: { id: 9, title: 'Shared CPU', libraryPanel: { uid: 'lp-1', name: 'shared-cpu' } },
    };

    jest.spyOn(libraryPanelsApi, 'getLibraryPanel').mockResolvedValue({
      uid: 'lp-1',
      name: 'shared-cpu',
      version: 1,
      model: { type: 'timeseries' },
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the fields above are read
    } as never);

    const manager = deserializeNotebookLayout(layout, elements);
    const libraryVizPanel = manager
      .getVizPanels()
      .find((panel) => panel.state.pluginId === LibraryPanelBehavior.LOADING_VIZ_PANEL_PLUGIN_ID);
    expect(libraryVizPanel).toBeDefined();

    // Just this panel, not the whole manager: the fixture's other panel would also activate its own
    // (unrelated, unmocked) query runner and try to run a real query.
    const deactivate = activateFullSceneTree(libraryVizPanel!);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(libraryVizPanel!.state.pluginId).toBe('timeseries');
    deactivate();
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
