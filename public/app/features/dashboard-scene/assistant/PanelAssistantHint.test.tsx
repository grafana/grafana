import { getPanelPlugin } from '@grafana/data/test';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { SceneDataTransformer, SceneGridLayout, VizPanel, sceneGraph } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

import {
  PanelAssistantHintItem,
  addAssistantHintsToAllPanels,
  addAssistantHintToPanel,
  removeAssistantHintsFromAllPanels,
} from './PanelAssistantHint';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: (uid: string) => ({}),
  }),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('PanelAssistantHint', () => {
  beforeEach(() => {
    config.featureToggles.dashboardNewLayouts = true;
  });

  describe('addAssistantHintToPanel', () => {
    it('should add a hint titleItem to a panel with no existing titleItems', () => {
      const panel = new VizPanel({ key: 'panel-1', title: 'Test Panel', pluginId: 'timeseries' });

      addAssistantHintToPanel(panel);

      expect(panel.state.titleItems).toBeInstanceOf(PanelAssistantHintItem);
    });

    it('should not add duplicate hints', () => {
      const panel = new VizPanel({ key: 'panel-1', title: 'Test Panel', pluginId: 'timeseries' });

      addAssistantHintToPanel(panel);
      addAssistantHintToPanel(panel);

      expect(panel.state.titleItems).toBeInstanceOf(PanelAssistantHintItem);
    });
  });

  describe('addAssistantHintsToAllPanels', () => {
    it('should add hints to all VizPanels on the dashboard', () => {
      const scene = buildTestSceneWithPanels();
      const panels = sceneGraph.findAllObjects(scene, (obj) => obj instanceof VizPanel) as VizPanel[];

      expect(panels.length).toBeGreaterThan(0);

      addAssistantHintsToAllPanels(scene);

      for (const panel of panels) {
        const titleItems = panel.state.titleItems;
        const hasHint =
          titleItems instanceof PanelAssistantHintItem ||
          (Array.isArray(titleItems) && titleItems.some((item) => item instanceof PanelAssistantHintItem));
        expect(hasHint).toBe(true);
      }
    });
  });

  describe('removeAssistantHintsFromAllPanels', () => {
    it('should remove all hints from panels', () => {
      const scene = buildTestSceneWithPanels();
      addAssistantHintsToAllPanels(scene);

      removeAssistantHintsFromAllPanels(scene);

      const panels = sceneGraph.findAllObjects(scene, (obj) => obj instanceof VizPanel) as VizPanel[];
      for (const panel of panels) {
        const titleItems = panel.state.titleItems;
        const hasHint =
          titleItems instanceof PanelAssistantHintItem ||
          (Array.isArray(titleItems) && titleItems.some((item) => item instanceof PanelAssistantHintItem));
        expect(hasHint).toBe(false);
      }
    });
  });
});

function buildTestSceneWithPanels() {
  const panel1 = new VizPanel({
    key: 'panel-1',
    title: 'Panel 1',
    pluginId: 'timeseries',
    $data: new SceneDataTransformer({ transformations: [] }),
  });
  const panel2 = new VizPanel({
    key: 'panel-2',
    title: 'Panel 2',
    pluginId: 'stat',
    $data: new SceneDataTransformer({ transformations: [] }),
  });

  const scene = new DashboardScene({
    title: 'test',
    uid: 'dash-1',
    editable: true,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [
          new DashboardGridItem({ x: 0, y: 0, width: 12, height: 8, body: panel1 }),
          new DashboardGridItem({ x: 12, y: 0, width: 12, height: 8, body: panel2 }),
        ],
      }),
    }),
  });

  config.featureToggles.dashboardNewLayouts = true;
  activateFullSceneTree(scene);

  return scene;
}
