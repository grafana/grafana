import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange, sceneGraph, VizPanel } from '@grafana/scenes';

import { activateFullSceneTree } from '../utils/test-utils';

import { registerDashboardMacro } from './DashboardMacro';
import { DashboardScene } from './DashboardScene';
import { AutoGridItem } from './layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from './layout-auto-grid/AutoGridLayout';
import {
  AutoGridLayoutManager,
  getAutoRowsTemplate,
  getTemplateColumnsTemplate,
} from './layout-auto-grid/AutoGridLayoutManager';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginLinkExtensions: jest.fn().mockReturnValue({ extensions: [] }),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('DashboardMacro', () => {
  let scene: DashboardScene;
  let panel: VizPanel;

  let unregisterMacro: () => void;

  beforeEach(() => {
    unregisterMacro = registerDashboardMacro();

    panel = new VizPanel({
      title: 'Test Panel',
      key: 'panel-1',
      pluginId: 'timeseries',
    });

    scene = new DashboardScene({
      uid: 'test-dashboard-uid',
      title: 'Test Dashboard',
      $timeRange: new SceneTimeRange({
        from: '2023-05-23T06:09:57.073Z',
        to: '2023-05-23T07:09:57.073Z',
      }),
      body: new AutoGridLayoutManager({
        maxColumnCount: 12,
        columnWidth: 100,
        rowHeight: 100,
        fillScreen: true,
        layout: new AutoGridLayout({
          isDraggable: true,
          templateColumns: getTemplateColumnsTemplate(12, 100),
          autoRows: getAutoRowsTemplate(100, true),
          children: [
            new AutoGridItem({
              body: panel,
            }),
          ],
        }),
      }),
    });

    activateFullSceneTree(scene);
  });
  afterEach(() => {
    unregisterMacro();
  });

  describe('timeRange functionality', () => {
    it('should interpolate ${__dashboard.timeRange.from} to timestamp', async () => {
      // Wait for the scene to be fully activated
      await new Promise((resolve) => setTimeout(resolve, 1));

      const result = sceneGraph.interpolate(panel, '${__dashboard.timeRange.from}');
      expect(result).toBe('1684822197073'); // 2023-05-23T06:09:57.073Z as timestamp
    });

    it('should interpolate ${__dashboard.timeRange.to} to timestamp', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));

      const result = sceneGraph.interpolate(panel, '${__dashboard.timeRange.to}');
      expect(result).toBe('1684825797073'); // 2023-05-23T07:09:57.073Z as timestamp
    });
  });
});
