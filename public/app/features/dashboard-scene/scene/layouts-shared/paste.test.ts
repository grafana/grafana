import { store } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange } from '@grafana/scenes';
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

function buildAutoGridClipboard(): PanelStore {
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
      },
    },
  };
}

function buildGridLayoutClipboard(): PanelStore {
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

  test('if the clipboard contains an AutoGridLayoutItem, it returns an AutoGridItem ', () => {
    const { scene } = setup(buildAutoGridClipboard());

    const result = getAutoGridItemFromClipboard(scene);

    expect(result).toBeInstanceOf(AutoGridItem);
  });

  test('if the clipboard contains a GridLayoutItem, it returns an AutoGridItem', () => {
    const { scene } = setup(buildGridLayoutClipboard());

    const result = getAutoGridItemFromClipboard(scene);

    expect(result).toBeInstanceOf(AutoGridItem);
  });

  test('preserves the grid item key and variableName, as well as the panel title and pluginId', () => {
    const { scene } = setup(buildAutoGridClipboard());

    const result = getAutoGridItemFromClipboard(scene);

    expect(result.state.key).toBe('grid-item-1');
    expect(result.state.variableName).toBe('testVarAuto');
    expect(result.state.body.state.title).toBe('Test Panel 42');
    expect(result.state.body.state.pluginId).toBe('timeseries');
  });

  test('the returned VizPanel is parented to the AutoGridItem, not to the deserialized grid item', () => {
    const { scene } = setup(buildGridLayoutClipboard());

    const result = getAutoGridItemFromClipboard(scene);

    expect(result.state.body.parent).toBe(result);
  });
});

describe('getDashboardGridItemFromClipboard()', () => {
  afterEach(() => {
    store.delete(LS_PANEL_COPY_KEY);
  });

  test('if the clipboard contains a GridLayoutItem, it returns a DashboardGridItem', () => {
    const { scene } = setup(buildGridLayoutClipboard());

    const result = getDashboardGridItemFromClipboard(scene, null);

    expect(result).toBeInstanceOf(DashboardGridItem);
  });

  test('if the clipboard contains an AutoGridLayoutItem, it returns a DashboardGridItem', () => {
    const { scene } = setup(buildAutoGridClipboard());

    const result = getDashboardGridItemFromClipboard(scene, null);

    expect(result).toBeInstanceOf(DashboardGridItem);
  });

  test('preserves the grid item key and variableName, as well as the panel title and pluginId', () => {
    const { scene } = setup(buildGridLayoutClipboard());

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
});
