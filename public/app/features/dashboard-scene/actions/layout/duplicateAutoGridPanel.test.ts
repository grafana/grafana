import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { CustomVariable, SceneQueryRunner, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { duplicateAutoGridPanel } from './duplicateAutoGridPanel';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('duplicateAutoGridPanel', () => {
  let deactivate: () => void;

  function setup() {
    const panel = new VizPanel({
      key: 'panel-1',
      title: 'Panel',
      pluginId: 'table',
      options: { showHeader: true },
      $data: new SceneQueryRunner({ queries: [{ refId: 'A' }], runQueriesMode: 'manual' }),
    });
    const item = new AutoGridItem({ key: 'grid-item-1', body: panel, fitContent: true });
    const sibling = new AutoGridItem({
      key: 'grid-item-2',
      body: new VizPanel({ key: 'panel-2', pluginId: 'table' }),
    });
    const layout = new AutoGridLayout({ children: [item, sibling] });
    const manager = new AutoGridLayoutManager({ layout });
    const dashboard = new DashboardScene({
      isEditing: true,
      body: manager,
    });
    deactivate = activateFullSceneTree(dashboard);
    return { manager, panel, item, sibling, layout, sidebar: dashboard.state.sidebar };
  }

  afterEach(() => deactivate?.());

  it('inserts an independent clone after the source and records one duplicate action', () => {
    const { manager, panel, item, sibling, layout, sidebar } = setup();

    duplicateAutoGridPanel(manager, panel);

    const duplicate = layout.state.children[1];
    expect(layout.state.children).toEqual([item, duplicate, sibling]);
    expect(duplicate.state.key).toBe('grid-item-3');
    expect(duplicate.state.fitContent).toBe(true);
    expect(duplicate.state.body.state).toMatchObject({
      key: 'panel-3',
      title: 'Panel',
      options: { showHeader: true },
    });
    expect(duplicate.state.body).not.toBe(panel);
    expect(duplicate.state.body.state.options).not.toBe(panel.state.options);
    expect(duplicate.state.body.state.$data).not.toBe(panel.state.$data);
    expect(duplicate.state.body.state.$data?.state).toMatchObject({ queries: [{ refId: 'A' }] });
    expect(duplicate.state.conditionalRendering).not.toBe(item.state.conditionalRendering);
    expect(duplicate.parent).toBe(layout);
    expect(duplicate.state.body.parent).toBe(duplicate);
    expect(sidebar.state.undoStack.map((action) => action.description)).toEqual(['Duplicate panel']);
  });

  it('ignores repeat clones without changing the layout or recording an undo action', () => {
    const source = new AutoGridItem({
      key: 'grid-item-2',
      body: new VizPanel({ key: 'panel-2', pluginId: 'table' }),
      variableName: 'Values',
    });
    const layout = new AutoGridLayout({
      children: [
        new AutoGridItem({ body: new VizPanel({ key: 'panel-1', pluginId: 'table' }) }),
        source,
        new AutoGridItem({ body: new VizPanel({ key: 'panel-3', pluginId: 'table' }) }),
      ],
    });
    const manager = new AutoGridLayoutManager({ layout });
    const dashboard = new DashboardScene({
      isEditing: true,
      body: manager,
      $variables: new SceneVariableSet({
        variables: [
          new CustomVariable({
            name: 'Values',
            query: 'Value1,Value2',
            options: [
              { label: 'Value1', value: 'Value1' },
              { label: 'Value2', value: 'Value2' },
            ],
            value: ['Value1', 'Value2'],
            text: ['Value1', 'Value2'],
            isMulti: true,
          }),
        ],
      }),
    });
    deactivate = activateFullSceneTree(dashboard);
    source.performRepeat();
    const repeatClone = source.state.repeatedPanels![0];
    expect(repeatClone.state.key).toBe('panel-2-clone-1');
    expect(repeatClone.parent).toBe(source);

    const childrenBefore = layout.state.children;
    const repeatsBefore = source.state.repeatedPanels;
    const undoStackBefore = dashboard.state.sidebar.state.undoStack;

    duplicateAutoGridPanel(manager, repeatClone);

    expect(layout.state.children === childrenBefore).toBe(true);
    expect(source.state.repeatedPanels === repeatsBefore).toBe(true);
    expect(dashboard.state.sidebar.state.undoStack === undoStackBefore).toBe(true);
  });

  it('selects the duplicated panel', () => {
    const { manager, panel, layout, sidebar } = setup();

    duplicateAutoGridPanel(manager, panel);

    expect(sidebar.getSelectedObject()).toBe(layout.state.children[1].state.body);
  });

  it('restores the original children and clears duplicate selection on undo', () => {
    const { manager, panel, item, sibling, layout, sidebar } = setup();
    duplicateAutoGridPanel(manager, panel);

    sidebar.undoAction();

    expect(layout.state.children).toEqual([item, sibling]);
    expect(sidebar.getSelectedObject()).toBeUndefined();
    expect(sidebar.state.undoStack).toEqual([]);
    expect(sidebar.state.redoStack.map((action) => action.description)).toEqual(['Duplicate panel']);
  });

  it('restores the same duplicate and IDs on redo without recording another action', () => {
    const { manager, panel, item, sibling, layout, sidebar } = setup();
    duplicateAutoGridPanel(manager, panel);
    const duplicate = layout.state.children[1];
    const duplicatedPanel = duplicate.state.body;
    sidebar.undoAction();

    sidebar.redoAction();

    expect(layout.state.children).toEqual([item, duplicate, sibling]);
    expect(layout.state.children[1]).toBe(duplicate);
    expect(duplicate.state.body).toBe(duplicatedPanel);
    expect(duplicate.state.key).toBe('grid-item-3');
    expect(duplicatedPanel.state.key).toBe('panel-3');
    expect(duplicate.parent).toBe(layout);
    expect(sidebar.getSelectedObject()).toBe(duplicatedPanel);
    expect(sidebar.state.undoStack.map((action) => action.description)).toEqual(['Duplicate panel']);
    expect(sidebar.state.redoStack).toEqual([]);
  });

  it('restores the current grid item wrapper on redo after it has been replaced', () => {
    const { manager, panel, item, sibling, layout, sidebar } = setup();
    duplicateAutoGridPanel(manager, panel);
    const duplicate = layout.state.children[1];
    duplicate.state.body.clearParent();
    const replacement = new AutoGridItem({ key: duplicate.state.key, body: duplicate.state.body });
    layout.setState({ children: [item, replacement, sibling] });

    sidebar.undoAction();
    expect(layout.state.children).toEqual([item, sibling]);

    sidebar.redoAction();

    expect(layout.state.children).toEqual([item, replacement, sibling]);
    expect(layout.state.children[1]).toBe(replacement);
    expect(replacement.state.body.parent).toBe(replacement);
  });

  it('keeps one duplicate after repeated undo and redo', () => {
    const { manager, panel, item, sibling, layout, sidebar } = setup();
    duplicateAutoGridPanel(manager, panel);
    const duplicate = layout.state.children[1];
    sidebar.undoAction();
    sidebar.redoAction();
    sidebar.undoAction();

    sidebar.redoAction();

    expect(layout.state.children).toEqual([item, duplicate, sibling]);
    expect(layout.state.children[1]).toBe(duplicate);
    expect(sidebar.state.undoStack.map((action) => action.description)).toEqual(['Duplicate panel']);
  });
});
