import { store } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange } from '@grafana/scenes';
import { AutoGridLayoutItemKind, GridLayoutItemKind } from '@grafana/schema/dist/esm/schema/dashboard/v2beta1';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';

import { DashboardScene } from '../DashboardScene';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';

import { PanelStore, getAutoGridItemFromClipboard, getDashboardGridItemFromClipboard } from './paste';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

function buildDashboardScene(): DashboardScene {
  return new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: AutoGridLayoutManager.createEmpty(),
  });
}

function buildAutoGridClipboard(): PanelStore & { gridItem: AutoGridLayoutItemKind } {
  return {
    elements: {
      'panel-42': {
        kind: 'Panel',
        spec: {
          id: 42,
          title: 'Test Panel 42',
          description: '',
          links: [],
          data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
          vizConfig: {
            kind: 'VizConfig',
            group: 'timeseries',
            version: '13.0.0',
            spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } },
          },
        },
      },
    },
    gridItem: {
      kind: 'AutoGridLayoutItem',
      spec: {
        element: { kind: 'ElementReference', name: 'panel-42' },
        repeat: { mode: 'variable', value: 'testVarAuto' },
        conditionalRendering: {
          kind: 'ConditionalRenderingGroup',
          spec: { condition: 'and', visibility: 'hide', items: [] },
        },
      },
    },
  };
}

function buildCustomGridLayoutClipboard(): PanelStore & { gridItem: GridLayoutItemKind } {
  return {
    elements: {
      'panel-43': {
        kind: 'Panel',
        spec: {
          id: 43,
          title: 'Test Panel 43',
          description: '',
          links: [],
          data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
          vizConfig: {
            kind: 'VizConfig',
            group: 'table',
            version: '13.0.0',
            spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } },
          },
        },
      },
    },
    gridItem: {
      kind: 'GridLayoutItem',
      spec: {
        x: 5,
        y: 10,
        width: 12,
        height: 8,
        element: { kind: 'ElementReference', name: 'panel-43' },
        repeat: { mode: 'variable', value: 'testVarGrid' },
      },
    },
  };
}

function setup(panelStore: PanelStore) {
  const scene = buildDashboardScene();
  store.set(LS_PANEL_COPY_KEY, JSON.stringify(panelStore));
  return { scene };
}

describe('getAutoGridItemFromClipboard()', () => {
  afterEach(() => {
    store.delete(LS_PANEL_COPY_KEY);
  });

  it.each([
    { name: 'AutoGridLayoutItem', buildClipboard: buildAutoGridClipboard },
    { name: 'GridLayoutItem', buildClipboard: buildCustomGridLayoutClipboard },
  ])('if the clipboard contains a $name, it returns an AutoGridItem', ({ buildClipboard }) => {
    const { scene } = setup(buildClipboard());

    const result = getAutoGridItemFromClipboard(scene);

    expect(result).toBeInstanceOf(AutoGridItem);
  });

  test('preserves the grid item key, variableName and conditionalRendering, as well as the panel title and pluginId', () => {
    const { scene } = setup(buildAutoGridClipboard());

    const result = getAutoGridItemFromClipboard(scene);

    expect(result.state.key).toBe('grid-item-1');
    expect(result.state.variableName).toBe('testVarAuto');
    expect(result.state.conditionalRendering!.state.visibility).toBe('hide');
    expect(result.state.body.state.title).toBe('Test Panel 42');
    expect(result.state.body.state.pluginId).toBe('timeseries');
  });

  test('the returned VizPanel is parented to the AutoGridItem, not to the deserialized grid item', () => {
    const { scene } = setup(buildCustomGridLayoutClipboard());

    const result = getAutoGridItemFromClipboard(scene);

    expect(result.state.body.parent).toBe(result);
  });
});

describe('getDashboardGridItemFromClipboard()', () => {
  afterEach(() => {
    store.delete(LS_PANEL_COPY_KEY);
  });

  it.each([
    { name: 'GridLayoutItem', buildClipboard: buildCustomGridLayoutClipboard },
    { name: 'AutoGridLayoutItem', buildClipboard: buildAutoGridClipboard },
  ])('if the clipboard contains a $name, it returns a DashboardGridItem', ({ buildClipboard }) => {
    const { scene } = setup(buildClipboard());

    const result = getDashboardGridItemFromClipboard(scene, null);

    expect(result).toBeInstanceOf(DashboardGridItem);
  });

  test('preserves the grid item key and variableName, as well as the panel title and pluginId', () => {
    const { scene } = setup(buildCustomGridLayoutClipboard());

    const result = getDashboardGridItemFromClipboard(scene, null);

    expect(result.state.key).toBe('grid-item-1');
    expect(result.state.variableName).toBe('testVarGrid');
    expect(result.state.body.state.title).toBe('Test Panel 43');
    expect(result.state.body.state.pluginId).toBe('table');
  });

  test('the returned VizPanel is parented to the DashboardGridItem, not to the deserialized grid item', () => {
    const { scene } = setup(buildAutoGridClipboard());

    const result = getDashboardGridItemFromClipboard(scene, null);

    expect(result.state.body.parent).toBe(result);
  });

  describe('when the clipboard contains a GridLayoutItem', () => {
    test('uses gridCell position but preserves the clipboard dimensions', () => {
      const customGridLayout = buildCustomGridLayoutClipboard();
      const { scene } = setup(customGridLayout);
      const gridCell = { x: 1, y: 2, width: 3, height: 4 };

      const result = getDashboardGridItemFromClipboard(scene, gridCell);

      expect(result.state.x).toBe(gridCell.x);
      expect(result.state.y).toBe(gridCell.y);
      expect(result.state.width).toBe(customGridLayout.gridItem.spec.width);
      expect(result.state.height).toBe(customGridLayout.gridItem.spec.height);
    });
  });

  describe('when the clipboard contains an AutoGridLayoutItem', () => {
    test('uses gridCell for both position and dimensions', () => {
      const { scene } = setup(buildAutoGridClipboard());
      const gridCell = { x: 5, y: 6, width: 7, height: 8 };

      const result = getDashboardGridItemFromClipboard(scene, gridCell);

      expect(result.state.x).toBe(gridCell.x);
      expect(result.state.y).toBe(gridCell.y);
      expect(result.state.width).toBe(gridCell.width);
      expect(result.state.height).toBe(gridCell.height);
    });
  });
});
