import { waitFor } from '@testing-library/react';
import { testWithFeatureToggles } from 'test/test-utils';

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

import { replacePanel } from './replacePanel';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('replacePanel', () => {
  testWithFeatureToggles({ enable: ['dashboardNewLayouts'] });
  let deactivate: () => void;

  afterEach(() => deactivate?.());

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
    const oldPanel = new VizPanel({ key: 'panel-1', title: 'Original', pluginId: 'table' });
    const newPanel = new VizPanel({ key: 'new-panel', title: 'Replacement', pluginId: 'timeseries' });
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

    replacePanel({ source, oldPanel, newPanel });

    expect(source.state.repeatedPanels).toMatchObject([
      { state: { title: 'Replacement', pluginId: 'timeseries' } },
      { state: { title: 'Replacement', pluginId: 'timeseries' } },
    ]);

    dashboard.state.sidebar.undoAction();

    expect(source.state.repeatedPanels).toMatchObject([
      { state: { title: 'Original', pluginId: 'table' } },
      { state: { title: 'Original', pluginId: 'table' } },
    ]);

    dashboard.state.sidebar.redoAction();

    expect(source.state.repeatedPanels).toMatchObject([
      { state: { title: 'Replacement', pluginId: 'timeseries' } },
      { state: { title: 'Replacement', pluginId: 'timeseries' } },
    ]);
  });

  it('redoes library panel replacement without fetching the library panel again', async () => {
    const { source, oldPanel, newPanel, sidebar } = setup();
    const originalState = source.state;
    const behavior = new LibraryPanelBehavior({ uid: 'library-1', name: 'Library panel' });
    newPanel.setState({ $behaviors: [behavior] });
    const getLibraryPanel = jest.spyOn(libraryPanelApi, 'getLibraryPanel').mockResolvedValue({
      uid: 'library-1',
      name: 'Library panel',
      version: 1,
      type: 'timeseries',
      model: { type: 'timeseries', title: 'Library panel' },
    });

    let deactivatePanel: (() => void) | undefined;
    try {
      replacePanel({ source, oldPanel, newPanel });
      deactivatePanel = source.state.body.activate();
      await waitFor(() => expect(behavior.state.isLoaded).toBe(true));
      expect(getLibraryPanel).toHaveBeenCalledTimes(1);
      expect(getLibraryPanel).toHaveBeenCalledWith('library-1', true);
      deactivatePanel();
      sidebar.undoAction();

      sidebar.redoAction();
      deactivatePanel = source.state.body.activate();

      expect(source.state.body.state.$behaviors).toEqual([behavior]);
      expect(behavior.state.uid).toBe('library-1');
      expect(behavior.state.isLoaded).toBe(true);
      expect(getLibraryPanel).toHaveBeenCalledTimes(1);

      expect(newPanel.state.key).toBe('panel-1');
      expect(source.state.body).toBe(newPanel);
      expect(newPanel.parent).toBe(source);
      expect(source.state).toEqual({ ...originalState, body: newPanel });
      expect(sidebar.getSelectedObject()).toBe(newPanel);
      expect(sidebar.state.undoStack).toHaveLength(1);
      expect(sidebar.state.redoStack).toHaveLength(0);
    } finally {
      deactivatePanel?.();
      getLibraryPanel.mockRestore();
    }
  });
});
