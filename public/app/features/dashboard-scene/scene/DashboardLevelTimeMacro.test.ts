import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange, sceneGraph, sceneUtils, VizPanel } from '@grafana/scenes';

import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardLevelTimeMacro } from './DashboardLevelTimeMacro';
import { DashboardScene } from './DashboardScene';
import { PanelTimeRange } from './PanelTimeRange';
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

describe('dashboardLevelTimeMacros', () => {
  it('Can use use $__from and $__to', async () => {
    const panel = new VizPanel({
      $timeRange: new PanelTimeRange({ timeShift: '1h' }),
      title: 'Test Panel',
      key: 'panel-1',
      pluginId: 'timeseries',
    });

    const scene = new DashboardScene({
      $timeRange: new SceneTimeRange({ from: '2023-05-23T06:09:57.073Z', to: '2023-05-23T07:09:57.073Z' }),
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

    // Wait for the scene to be activated
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(sceneGraph.interpolate(scene, '$__from')).toBe('1684822197073'); // Dashboard level time range
    expect(sceneGraph.interpolate(scene, '$__to')).toBe('1684825797073'); // Dashboard level time range

    expect(sceneGraph.interpolate(panel, '$__from')).toBe('1684818597073'); // Time shifted by 1h
    expect(sceneGraph.interpolate(panel, '$__to')).toBe('1684822197073'); // Time shifted by 1h

    sceneUtils.registerVariableMacro('__from', DashboardLevelTimeMacro, true);
    sceneUtils.registerVariableMacro('__to', DashboardLevelTimeMacro, true);

    expect(sceneGraph.interpolate(panel, '$__from')).toBe('1684822197073'); // Dashboard level time range even when panel is time shifted
    expect(sceneGraph.interpolate(panel, '$__to')).toBe('1684825797073'); // Dashboard level time range even when panel is time shifted
  });
});
