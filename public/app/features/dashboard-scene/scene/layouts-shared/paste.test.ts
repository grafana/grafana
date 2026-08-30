import { store } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange } from '@grafana/scenes';
import {
  type AutoGridLayoutItemKind,
  type GridLayoutItemKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2beta1';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';

import { ConditionalRenderingVariable } from '../../conditional-rendering/conditions/ConditionalRenderingVariable';
import { DashboardScene } from '../DashboardScene';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';

import { type PanelStore, getAutoGridItemFromClipboard, getDashboardGridItemFromClipboard } from './paste';

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
      'panel-auto-grid': {
        kind: 'Panel',
        spec: {
          id: 42,
          title: 'Test Panel Auto Grid',
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
        element: { kind: 'ElementReference', name: 'panel-auto-grid' },
        repeat: { mode: 'variable', value: 'testVarAuto' },
        conditionalRendering: {
          kind: 'ConditionalRenderingGroup',
          spec: {
            condition: 'and',
            visibility: 'hide',
            items: [
              {
                kind: 'ConditionalRenderingVariable',
                spec: { variable: 'testVarAuto', operator: 'equals', value: '42' },
              },
            ],
          },
        },
      },
    },
  };
}

function buildCustomGridClipboard(): PanelStore & { gridItem: GridLayoutItemKind } {
  return {
    elements: {
      'panel-custom-grid': {
        kind: 'Panel',
        spec: {
          id: 43,
          title: 'Test Panel Custom Grid',
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
        element: { kind: 'ElementReference', name: 'panel-custom-grid' },
        repeat: { mode: 'variable', value: 'testVarGrid' },
      },
    },
  };
}

function setup(panelStore: PanelStore) {
  const dashboardScene = buildDashboardScene();
  store.set(LS_PANEL_COPY_KEY, JSON.stringify(panelStore));
  return { dashboardScene };
}

describe('getAutoGridItemFromClipboard(dashboardScene)', () => {
  afterEach(() => {
    store.delete(LS_PANEL_COPY_KEY);
  });

  it.each([
    { name: 'AutoGridLayoutItem', buildClipboard: buildAutoGridClipboard },
    { name: 'GridLayoutItem', buildClipboard: buildCustomGridClipboard },
  ])('if the clipboard contains a $name, it returns an AutoGridItem', ({ buildClipboard }) => {
    const { dashboardScene } = setup(buildClipboard());

    const result = getAutoGridItemFromClipboard(dashboardScene);

    expect(result).toBeInstanceOf(AutoGridItem);
  });

  describe('when the item from clipboard is an AutoGridItem', () => {
    test('preserves the grid item key, variableName and conditionalRendering, as well as panel properties (title and pluginId)', () => {
      const { dashboardScene } = setup(buildAutoGridClipboard());

      const result = getAutoGridItemFromClipboard(dashboardScene);

      expect(result.state.key).toBe('grid-item-1');
      expect(result.state.variableName).toBe('testVarAuto');

      const { visibility, conditions } = result.state.conditionalRendering!.state;
      expect(visibility).toBe('hide');
      expect(conditions[0]).toBeInstanceOf(ConditionalRenderingVariable);
      expect((conditions[0] as ConditionalRenderingVariable).state).toEqual(
        expect.objectContaining({
          variable: 'testVarAuto',
          operator: '=',
          value: '42',
        })
      );

      expect(result.state.body.state.title).toBe('Test Panel Auto Grid');
      expect(result.state.body.state.pluginId).toBe('timeseries');
    });
  });

  describe('when the item from clipboard is not an AutoGridItem', () => {
    test('the returned VizPanel is parented to the AutoGridItem, not to the deserialized grid item', () => {
      const { dashboardScene } = setup(buildCustomGridClipboard());

      const result = getAutoGridItemFromClipboard(dashboardScene);

      expect(result.state.body.parent).toBe(result);
    });

    test('preserves the grid item key and variableName, as well as panel properties (title and pluginId)', () => {
      const { dashboardScene } = setup(buildCustomGridClipboard());

      const result = getAutoGridItemFromClipboard(dashboardScene);

      expect(result.state.key).toBe('grid-item-1');
      expect(result.state.variableName).toBe('testVarGrid');

      const { visibility, conditions } = result.state.conditionalRendering!.state;
      expect(visibility).toBe('show');
      expect(conditions).toEqual([]);

      expect(result.state.body.state.title).toBe('Test Panel Custom Grid');
      expect(result.state.body.state.pluginId).toBe('table');
    });
  });

  test('throws when deserialization fails', () => {
    const clipboard = { ...buildAutoGridClipboard(), elements: {} };
    const { dashboardScene } = setup(clipboard);

    expect.assertions(4);

    try {
      getAutoGridItemFromClipboard(dashboardScene);
    } catch (error) {
      const thrown = error as Error;

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown.message).toBe('Error pasting panel from clipboard, please try to copy again.');

      expect(thrown.cause).toBeInstanceOf(Error);
      expect((thrown.cause as Error).message).toBe(
        'Panel with uid panel-auto-grid not found in the dashboard elements'
      );
    }
  });
});

describe('getDashboardGridItemFromClipboard(dashboardScene, gridCell)', () => {
  afterEach(() => {
    store.delete(LS_PANEL_COPY_KEY);
  });

  it.each([
    { name: 'GridLayoutItem', buildClipboard: buildCustomGridClipboard },
    { name: 'AutoGridLayoutItem', buildClipboard: buildAutoGridClipboard },
  ])('if the clipboard contains a $name, it returns a DashboardGridItem', ({ buildClipboard }) => {
    const { dashboardScene } = setup(buildClipboard());

    const result = getDashboardGridItemFromClipboard(dashboardScene, null);

    expect(result).toBeInstanceOf(DashboardGridItem);
  });

  describe('when the item from clipboard is a DashboardGridItem and gridCell is not null', () => {
    test('reposition the item to the grid cell, while preserving the grid item key and variableName, as well as panel properties (title and pluginId)', () => {
      const { dashboardScene } = setup(buildCustomGridClipboard());

      const gridCell = { x: 1, y: 2, width: 0, height: 0 };
      const result = getDashboardGridItemFromClipboard(dashboardScene, gridCell);

      expect(result.state.x).toBe(gridCell.x);
      expect(result.state.y).toBe(gridCell.y);
      expect(result.state.width).toBeGreaterThan(0);
      expect(result.state.height).toBeGreaterThan(0);

      expect(result.state.key).toBe('grid-item-1');
      expect(result.state.variableName).toBe('testVarGrid');

      expect(result.state.body.state.title).toBe('Test Panel Custom Grid');
      expect(result.state.body.state.pluginId).toBe('table');
    });
  });

  describe('when the item from clipboard is not a DashboardGridItem', () => {
    test('the returned VizPanel is parented to the DashboardGridItem, not to the deserialized grid item', () => {
      const { dashboardScene } = setup(buildCustomGridClipboard());

      const result = getDashboardGridItemFromClipboard(dashboardScene, null);

      expect(result.state.body.parent).toBe(result);
    });

    describe('if gridCell is not null', () => {
      test('uses it for both position and dimensions, while preserving the grid item key and variableName, as well as panel properties (title and pluginId)', () => {
        const { dashboardScene } = setup(buildAutoGridClipboard());
        const gridCell = { x: 5, y: 6, width: 7, height: 8 };

        const result = getDashboardGridItemFromClipboard(dashboardScene, gridCell);

        expect(result.state.x).toBe(gridCell.x);
        expect(result.state.y).toBe(gridCell.y);
        expect(result.state.width).toBe(gridCell.width);
        expect(result.state.height).toBe(gridCell.height);

        expect(result.state.key).toBe('grid-item-1');
        expect(result.state.variableName).toBe('testVarAuto');

        expect(result.state.body.state.title).toBe('Test Panel Auto Grid');
        expect(result.state.body.state.pluginId).toBe('timeseries');
      });
    });

    describe('if gridCell is null', () => {
      test('does not set any position or dimensions', () => {
        const { dashboardScene } = setup(buildAutoGridClipboard());

        const result = getDashboardGridItemFromClipboard(dashboardScene, null);

        expect(result.state.x).toBeUndefined();
        expect(result.state.y).toBeUndefined();
        expect(result.state.width).toBeUndefined();
        expect(result.state.height).toBeUndefined();

        expect(result.state.key).toBe('grid-item-1');
        expect(result.state.variableName).toBe('testVarAuto');

        expect(result.state.body.state.title).toBe('Test Panel Auto Grid');
        expect(result.state.body.state.pluginId).toBe('timeseries');
      });
    });
  });

  test('throws when deserialization fails', () => {
    const clipboard = { ...buildCustomGridClipboard(), elements: {} };
    const { dashboardScene } = setup(clipboard);

    expect.assertions(4);

    try {
      getAutoGridItemFromClipboard(dashboardScene);
    } catch (error) {
      const thrown = error as Error;

      expect(thrown).toBeInstanceOf(Error);
      expect(thrown.message).toBe('Error pasting panel from clipboard, please try to copy again.');

      expect(thrown.cause).toBeInstanceOf(Error);
      expect((thrown.cause as Error).message).toBe(
        'Panel with uid panel-custom-grid not found in the dashboard elements'
      );
    }
  });

  describe('legacy v1 panel clipboard (e.g. copied with Dynamic Dashboards off)', () => {
    const v1PanelClipboard = {
      id: 99,
      type: 'timeseries',
      title: 'Copied V1',
      gridPos: { x: 0, y: 0, w: 12, h: 8 },
      fieldConfig: { defaults: {}, overrides: [] },
      options: {},
    };

    test('getAutoGridItemFromClipboard wraps v1 panel in AutoGridItem', () => {
      const dashboardScene = buildDashboardScene();
      store.set(LS_PANEL_COPY_KEY, JSON.stringify(v1PanelClipboard));

      const result = getAutoGridItemFromClipboard(dashboardScene);

      expect(result).toBeInstanceOf(AutoGridItem);
      expect(result.state.body.state.title).toBe('Copied V1');
      expect(result.state.body.state.pluginId).toBe('timeseries');
    });

    test('getDashboardGridItemFromClipboard maps v1 panel to DashboardGridItem', () => {
      const dashboardScene = buildDashboardScene();
      store.set(LS_PANEL_COPY_KEY, JSON.stringify(v1PanelClipboard));

      const result = getDashboardGridItemFromClipboard(dashboardScene, { x: 3, y: 4, width: 0, height: 0 });

      expect(result).toBeInstanceOf(DashboardGridItem);
      expect(result.state.x).toBe(3);
      expect(result.state.y).toBe(4);
      expect(result.state.body.state.title).toBe('Copied V1');
    });
  });
});
