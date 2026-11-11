import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { CustomVariable, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { type EditableDashboardElement } from '../../scene/types/EditableDashboardElement';
import { activateFullSceneTree } from '../../utils/test-utils';
import { duplicateAutoGridPanel } from '../layout/duplicateAutoGridPanel';
import { getEditableElementFor } from '../utils/getEditableElementFor';

import { renameElement } from './renameElement';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

function getName(element: EditableDashboardElement) {
  return element.getEditableElementInfo().instanceName;
}

function setupPanel() {
  const panel = new VizPanel({ key: 'panel-1', title: 'Old', pluginId: 'table' });
  const dashboard = new DashboardScene({ isEditing: true, body: DefaultGridLayoutManager.fromVizPanels([panel]) });
  return { dashboard, source: panel };
}

function setupRow() {
  const row = new RowItem({ title: 'Old', layout: AutoGridLayoutManager.createEmpty() });
  const dashboard = new DashboardScene({ isEditing: true, body: new RowsLayoutManager({ rows: [row] }) });
  return { dashboard, source: row };
}

function setupTab() {
  const tab = new TabItem({ title: 'Old', layout: AutoGridLayoutManager.createEmpty() });
  const dashboard = new DashboardScene({ isEditing: true, body: new TabsLayoutManager({ tabs: [tab] }) });
  return { dashboard, source: tab };
}

function setupVariable() {
  const variable = new CustomVariable({ name: 'Old', query: 'a,b' });
  const dashboard = new DashboardScene({
    isEditing: true,
    $variables: new SceneVariableSet({ variables: [variable] }),
    body: DefaultGridLayoutManager.fromVizPanels([]),
  });
  return { dashboard, source: variable };
}

describe.each([
  ['panel', setupPanel],
  ['row', setupRow],
  ['tab', setupTab],
  ['variable', setupVariable],
])('renameElement (%s)', (_, setup) => {
  let deactivate: () => void;

  afterEach(() => deactivate?.());

  function renamed() {
    const { dashboard, source } = setup();
    deactivate = activateFullSceneTree(dashboard);
    const element = getEditableElementFor(source)!;
    // the outline applies the name live while typing and records it on commit
    element.onChangeName!('New');

    renameElement({ source, element, oldName: 'Old', newName: 'New' });

    return { element, sidebar: dashboard.state.sidebar };
  }

  it('records the rename', () => {
    const { element, sidebar } = renamed();

    expect(getName(element)).toBe('New');
    expect(sidebar.state.undoStack).toHaveLength(1);
  });

  it('undoes the rename', () => {
    const { element, sidebar } = renamed();

    sidebar.undoAction();

    expect(getName(element)).toBe('Old');
    expect(sidebar.state.undoStack).toHaveLength(0);
    expect(sidebar.state.redoStack).toHaveLength(1);
  });

  it('redoes the rename', () => {
    const { element, sidebar } = renamed();
    sidebar.undoAction();

    sidebar.redoAction();

    expect(getName(element)).toBe('New');
    expect(sidebar.state.undoStack).toHaveLength(1);
    expect(sidebar.state.redoStack).toHaveLength(0);
  });
});

it('replays an auto-grid duplicate and its rename in order', () => {
  const panel = new VizPanel({ key: 'panel-1', title: 'Original', pluginId: 'table' });
  const layout = new AutoGridLayoutManager({});
  layout.state.layout.setState({ children: [new AutoGridItem({ body: panel })] });
  const dashboard = new DashboardScene({ isEditing: true, body: layout });
  const deactivate = activateFullSceneTree(dashboard);
  const sidebar = dashboard.state.sidebar;
  try {
    duplicateAutoGridPanel(layout, panel);
    const duplicate = layout.state.layout.state.children[1].state.body;
    const element = getEditableElementFor(duplicate)!;
    renameElement({ source: duplicate, element, oldName: 'Original', newName: 'Renamed' });
    expect(duplicate.state.title).toBe('Renamed');
    expect(panel.state.title).toBe('Original');
    expect(sidebar.state.undoStack).toHaveLength(2);

    sidebar.undoAction();
    expect(duplicate.state.title).toBe('Original');
    sidebar.undoAction();
    expect(layout.getVizPanels()).toEqual([panel]);

    sidebar.redoAction();
    sidebar.redoAction();
    expect(layout.getVizPanels()).toEqual([panel, duplicate]);
    expect(duplicate.state.title).toBe('Renamed');
    expect(sidebar.getSelectedObject()).toBe(duplicate);
  } finally {
    deactivate();
  }
});
