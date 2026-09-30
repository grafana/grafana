import { testWithFeatureToggles } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { replacePanelWithLibraryPanel } from './replacePanelWithLibraryPanel';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('replacePanelWithLibraryPanel', () => {
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

  it('performs library panel replacement', () => {
    const { source, oldPanel, newPanel, sidebar } = setup();
    const originalState = source.state;

    replacePanelWithLibraryPanel({ source, oldPanel, newPanel });

    expect(newPanel.state.key).toBe('panel-1');
    expect(source.state.body).toBe(newPanel);
    expect(newPanel.parent).toBe(source);
    expect(source.state).toEqual({ ...originalState, body: newPanel });
    expect(sidebar.getSelectedObject()).toBe(newPanel);
    expect(sidebar.state.undoStack).toHaveLength(1);
    expect(sidebar.state.redoStack).toHaveLength(0);
  });

  it('undoes library panel replacement', () => {
    const { source, oldPanel, newPanel, sidebar } = setup();
    const originalState = source.state;
    replacePanelWithLibraryPanel({ source, oldPanel, newPanel });

    sidebar.undoAction();

    expect(source.state.body).toBe(oldPanel);
    expect(oldPanel.parent).toBe(source);
    expect(source.state).toEqual({ ...originalState, body: oldPanel });
    expect(sidebar.getSelectedObject()).toBe(oldPanel);
    expect(sidebar.state.undoStack).toHaveLength(0);
    expect(sidebar.state.redoStack).toHaveLength(1);
  });

  it('redoes library panel replacement', () => {
    const { source, oldPanel, newPanel, sidebar } = setup();
    const originalState = source.state;
    replacePanelWithLibraryPanel({ source, oldPanel, newPanel });
    sidebar.undoAction();

    sidebar.redoAction();

    expect(newPanel.state.key).toBe('panel-1');
    expect(source.state.body).toBe(newPanel);
    expect(newPanel.parent).toBe(source);
    expect(source.state).toEqual({ ...originalState, body: newPanel });
    expect(sidebar.getSelectedObject()).toBe(newPanel);
    expect(sidebar.state.undoStack).toHaveLength(1);
    expect(sidebar.state.redoStack).toHaveLength(0);
  });
});
