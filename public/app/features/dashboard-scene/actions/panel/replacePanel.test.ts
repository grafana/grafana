import { waitFor } from '@testing-library/react';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { CustomVariable, SceneGridLayout, SceneVariableSet, VizPanel } from '@grafana/scenes';
import * as libraryPanelApi from 'app/features/library-panels/state/api';

import { DashboardScene } from '../../scene/DashboardScene';
import { LibraryPanelBehavior } from '../../scene/LibraryPanelBehavior';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';
import { getLibraryPanelBehavior } from '../../utils/utils';

import { replacePanel } from './replacePanel';

setPluginImportUtils({
  importPanelPlugin: (id) => Promise.resolve(getPanelPlugin({ id })),
  getPanelPluginFromCache: () => undefined,
});

describe('replacePanel', () => {
  let deactivate: () => void;
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    deactivate?.();
    jest.restoreAllMocks();
  });

  function mockGetLibraryPanel() {
    return jest.spyOn(libraryPanelApi, 'getLibraryPanel').mockResolvedValue({
      uid: 'library-1',
      name: 'Library panel',
      version: 1,
      type: 'timeseries',
      model: { type: 'timeseries', title: 'Library panel' },
    });
  }

  // Nothing renders in tests, so panels are activated by hand. Safe to call unrender more than once.
  function render(panels: VizPanel[]) {
    const deactivators = panels.map((panel) => panel.activate());
    const unrender = () => deactivators.splice(0).forEach((d) => d());
    cleanups.push(unrender);
    return unrender;
  }

  function setup() {
    const oldPanel = new VizPanel({
      key: 'panel-1',
      title: 'Original',
      pluginId: 'table',
      options: { showHeader: false },
    });
    const newPanel = new VizPanel({ key: 'new-panel', title: 'Library panel', pluginId: 'timeseries' });
    const source = new AutoGridItem({ body: oldPanel, hideWhenNoData: true });
    const body = new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: [source] }) });
    const dashboard = new DashboardScene({ isEditing: true, body });
    deactivate = activateFullSceneTree(dashboard);
    dashboard.state.sidebar.selectObject(oldPanel);

    return { source, oldPanel, newPanel, sidebar: dashboard.state.sidebar };
  }

  function setupRepeated() {
    const oldPanel = new VizPanel({ key: 'panel-1', title: 'Original', pluginId: 'table' });
    const source = new DashboardGridItem({ body: oldPanel, variableName: 'server' });
    const dashboard = new DashboardScene({
      isEditing: true,
      $variables: new SceneVariableSet({
        variables: [
          new CustomVariable({
            name: 'server',
            query: 'A,B,C',
            isMulti: true,
            value: ['A', 'B', 'C'],
            text: ['A', 'B', 'C'],
          }),
        ],
      }),
      body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [source] }) }),
    });
    deactivate = activateFullSceneTree(dashboard);

    const getRenderedPanels = () => [source.state.body, ...(source.state.repeatedPanels ?? [])];

    return { source, oldPanel, sidebar: dashboard.state.sidebar, getRenderedPanels };
  }

  it('performs panel replacement', () => {
    const { source, oldPanel, newPanel, sidebar } = setup();
    const originalState = source.state;

    replacePanel({ source, oldPanel, newPanel });

    expect(newPanel.state.key).toBe('panel-1');
    expect(source.state.body).toBe(newPanel);
    expect(newPanel.parent).toBe(source);
    expect(source.state).toEqual({ ...originalState, body: newPanel });
    expect(sidebar.getSelectedObject()).toBe(newPanel);
    expect(sidebar.state.undoStack).toHaveLength(1);
    expect(sidebar.state.redoStack).toHaveLength(0);
  });

  it('undoes panel replacement', () => {
    const { source, oldPanel, newPanel, sidebar } = setup();
    const originalState = source.state;
    replacePanel({ source, oldPanel, newPanel });

    sidebar.undoAction();

    expect(source.state.body).toBe(oldPanel);
    expect(oldPanel.parent).toBe(source);
    expect(source.state).toEqual({ ...originalState, body: oldPanel });
    expect(sidebar.getSelectedObject()).toBe(oldPanel);
    expect(sidebar.state.undoStack).toHaveLength(0);
    expect(sidebar.state.redoStack).toHaveLength(1);
  });

  it('updates repeat clones when replacing a panel, undoing, and redoing', () => {
    const { source, oldPanel, sidebar } = setupRepeated();
    const newPanel = new VizPanel({ key: 'new-panel', title: 'Replacement', pluginId: 'timeseries' });
    // repeatSourceKey confirms the replacement took over the original panel key
    const replacementClones = [
      { state: { title: 'Replacement', pluginId: 'timeseries', repeatSourceKey: 'panel-1' } },
      { state: { title: 'Replacement', pluginId: 'timeseries', repeatSourceKey: 'panel-1' } },
    ];

    replacePanel({ source, oldPanel, newPanel });
    expect(source.state.repeatedPanels).toMatchObject(replacementClones);

    sidebar.undoAction();
    expect(source.state.repeatedPanels).toMatchObject([
      { state: { title: 'Original', pluginId: 'table' } },
      { state: { title: 'Original', pluginId: 'table' } },
    ]);

    sidebar.redoAction();
    expect(source.state.repeatedPanels).toMatchObject(replacementClones);
  });

  it('redoes library panel replacement without fetching the library panel again', async () => {
    const { source, oldPanel, newPanel, sidebar } = setup();
    const originalState = source.state;
    const behavior = new LibraryPanelBehavior({ uid: 'library-1', name: 'Library panel' });
    newPanel.setState({ $behaviors: [behavior] });
    const getLibraryPanel = mockGetLibraryPanel();

    replacePanel({ source, oldPanel, newPanel });
    const unrender = render([source.state.body]);
    await waitFor(() => expect(behavior.state.isLoaded).toBe(true));
    expect(getLibraryPanel).toHaveBeenCalledTimes(1);
    expect(getLibraryPanel).toHaveBeenCalledWith('library-1', true);
    unrender();
    sidebar.undoAction();

    sidebar.redoAction();
    render([source.state.body]);

    expect(getLibraryPanelBehavior(newPanel)).toBe(behavior);
    expect(behavior.state.isLoaded).toBe(true);
    expect(getLibraryPanel).toHaveBeenCalledTimes(1);

    expect(newPanel.state.key).toBe('panel-1');
    expect(source.state.body).toBe(newPanel);
    expect(newPanel.parent).toBe(source);
    expect(source.state).toEqual({ ...originalState, body: newPanel });
    expect(sidebar.getSelectedObject()).toBe(newPanel);
    expect(sidebar.state.undoStack).toHaveLength(1);
    expect(sidebar.state.redoStack).toHaveLength(0);
  });

  it('redoes repeated library panel replacement without fetching the library panel again for clones', async () => {
    const { source, oldPanel, sidebar, getRenderedPanels } = setupRepeated();
    const getLibraryPanel = mockGetLibraryPanel();
    // Same shape AddLibraryPanelDrawer passes to replacePanel: not loaded yet
    const newPanel = new VizPanel({
      key: 'new-panel',
      title: 'Library panel',
      pluginId: LibraryPanelBehavior.LOADING_VIZ_PANEL_PLUGIN_ID,
      $behaviors: [new LibraryPanelBehavior({ uid: 'library-1', name: 'Library panel' })],
    });

    replacePanel({ source, oldPanel, newPanel });
    const panels = getRenderedPanels();
    const unrender = render(panels);
    await waitFor(() => panels.forEach((p) => expect(getLibraryPanelBehavior(p)?.state.isLoaded).toBe(true)));
    // Clones are created before the library panel loads, so each repeat fetches it once
    expect(getLibraryPanel).toHaveBeenCalledTimes(3);
    unrender();
    sidebar.undoAction();

    sidebar.redoAction();
    const redonePanels = getRenderedPanels();
    render(redonePanels);

    expect(redonePanels.map((p) => p.state.pluginId)).toEqual(['timeseries', 'timeseries', 'timeseries']);
    expect(redonePanels.every((p) => getLibraryPanelBehavior(p)?.state.isLoaded)).toBe(true);
    expect(getLibraryPanel).toHaveBeenCalledTimes(3);
  });
});
