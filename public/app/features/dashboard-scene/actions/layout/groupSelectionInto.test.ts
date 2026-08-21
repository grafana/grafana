import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { groupSelectionInto } from './groupSelectionInto';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('groupSelectionInto', () => {
  it('groups the selection into a tab and supports undo/redo', () => {
    const p1 = new VizPanel({ key: 'panel-1', title: 'panel-1', pluginId: 'text' });
    const p2 = new VizPanel({ key: 'panel-2', title: 'panel-2', pluginId: 'text' });
    const p3 = new VizPanel({ key: 'panel-3', title: 'panel-3', pluginId: 'text' });
    const grid = new AutoGridLayoutManager({
      layout: new AutoGridLayout({
        children: [new AutoGridItem({ body: p1 }), new AutoGridItem({ body: p2 }), new AutoGridItem({ body: p3 })],
      }),
    });

    const dashboard = new DashboardScene({
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      isEditing: true,
      body: grid,
    });

    activateFullSceneTree(dashboard);

    groupSelectionInto({ source: dashboard, items: [p1, p3], target: 'tab' });

    const body = dashboard.state.body;
    expect(body).toBeInstanceOf(TabsLayoutManager);

    if (!(body instanceof TabsLayoutManager)) {
      throw new Error('expected tabs layout');
    }

    // The selection is grouped into the first tab; the untouched panel is partitioned into a second.
    expect(body.state.tabs).toHaveLength(2);

    const [tab1Panel1, tab1panel2] = body.state.tabs[0].getLayout().getVizPanels();
    const [tab2Panel3] = body.state.tabs[1].getLayout().getVizPanels();

    expect(tab1Panel1).toBe(p1);
    expect(tab1panel2).toBe(p3);
    expect(tab2Panel3).toBe(p2);

    expect(dashboard.state.sidebar.getSelectedObject()).toBe(body.state.tabs[0]);

    dashboard.state.sidebar.undoAction();

    const restoredBody = dashboard.state.body;
    expect(restoredBody).not.toBe(grid);
    expect(restoredBody).toBeInstanceOf(AutoGridLayoutManager);

    if (!(restoredBody instanceof AutoGridLayoutManager)) {
      throw new Error('expected auto grid layout');
    }

    // Undo restores a clone of the original container (see buildGroupEdit), so the panels are
    // clones too — compare by key rather than identity.
    const restoredKeys = restoredBody.getVizPanels().map((panel) => panel.state.key);
    expect(restoredKeys).toEqual([p1.state.key, p2.state.key, p3.state.key]);

    expect(dashboard.state.sidebar.getSelectedObject()).toBeUndefined();

    dashboard.state.sidebar.redoAction();

    expect(dashboard.state.body).toBeInstanceOf(TabsLayoutManager);
  });
});
