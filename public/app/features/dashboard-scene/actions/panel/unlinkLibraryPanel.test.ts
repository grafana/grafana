import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { LibraryPanelBehavior } from '../../scene/LibraryPanelBehavior';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';
import { isLibraryPanel } from '../../utils/utils';

import { unlinkLibraryPanel } from './unlinkLibraryPanel';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('unlinkLibraryPanel', () => {
  let deactivate: () => void;

  afterEach(() => deactivate?.());

  function setup() {
    const behavior = new LibraryPanelBehavior({ uid: 'lib-uid', name: 'Library panel', isLoaded: true });
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'table', $behaviors: [behavior] });
    const dashboard = new DashboardScene({ isEditing: true, body: DefaultGridLayoutManager.fromVizPanels([panel]) });
    deactivate = activateFullSceneTree(dashboard);

    return { dashboard, panel, behavior, sidebar: dashboard.state.sidebar };
  }

  it('unlinks the library panel as one undoable action', () => {
    const { dashboard, panel, sidebar } = setup();

    unlinkLibraryPanel(dashboard, panel);

    expect(isLibraryPanel(panel)).toBe(false);
    expect(sidebar.state.undoStack).toHaveLength(1);
  });

  it('undoes unlinking the library panel', () => {
    const { dashboard, panel, behavior, sidebar } = setup();
    unlinkLibraryPanel(dashboard, panel);

    sidebar.undoAction();

    expect(panel.state.$behaviors).toEqual([behavior]);
    expect(isLibraryPanel(panel)).toBe(true);
    expect(sidebar.state.undoStack).toHaveLength(0);
    expect(sidebar.state.redoStack).toHaveLength(1);
  });

  it('redoes unlinking the library panel', () => {
    const { dashboard, panel, sidebar } = setup();
    unlinkLibraryPanel(dashboard, panel);
    sidebar.undoAction();

    sidebar.redoAction();

    expect(isLibraryPanel(panel)).toBe(false);
    expect(sidebar.state.undoStack).toHaveLength(1);
    expect(sidebar.state.redoStack).toHaveLength(0);
  });

  it('re-runs auto grid repeats when undoing unlinking the library panel', () => {
    const behavior = new LibraryPanelBehavior({ uid: 'lib-uid', name: 'Library panel', isLoaded: true });
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'table', $behaviors: [behavior] });
    const gridItem = new AutoGridItem({ body: panel });
    const body = new AutoGridLayoutManager({});
    body.state.layout.setState({ children: [gridItem] });
    const dashboard = new DashboardScene({ isEditing: true, body });
    deactivate = activateFullSceneTree(dashboard);
    unlinkLibraryPanel(dashboard, panel);
    const handleEditChange = jest.spyOn(gridItem, 'handleEditChange');

    dashboard.state.sidebar.undoAction();

    expect(isLibraryPanel(panel)).toBe(true);
    expect(handleEditChange).toHaveBeenCalledTimes(1);
  });
});
