import { VizPanel } from '@grafana/scenes';
import {
  Spec as DashboardV2Spec,
  AutoGridLayoutItemKind,
  defaultPanelSpec,
  defaultLibraryPanelKind,
  PanelKind,
  LibraryPanelKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { ConditionalRenderingVariable } from '../../conditional-rendering/conditions/ConditionalRenderingVariable';
import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';

import {
  serializeAutoGridLayout,
  serializeAutoGridItem,
  deserializeAutoGridLayout,
  deserializeAutoGridItem,
} from './AutoGridLayoutSerializer';
import './test-matchers';

jest.mock('../../utils/dashboardSceneGraph', () => {
  const original = jest.requireActual('../../utils/dashboardSceneGraph');
  return {
    ...original,
    dashboardSceneGraph: {
      ...original.dashboardSceneGraph,
      getElementIdentifierForVizPanel: jest.fn().mockImplementation((panel: VizPanel) => {
        return panel?.state?.key || 'panel-1';
      }),
    },
  };
});

function buildPanel(overrides: Partial<PanelKind['spec']> = {}): PanelKind {
  return {
    kind: 'Panel',
    spec: {
      ...defaultPanelSpec(),
      id: 1,
      title: 'Test Panel',
      ...overrides,
    },
  };
}

function buildLibraryPanel(overrides: Partial<LibraryPanelKind['spec']> = {}): LibraryPanelKind {
  const base = defaultLibraryPanelKind();
  return {
    kind: 'LibraryPanel',
    spec: {
      ...base.spec,
      id: 1,
      title: 'Library Panel',
      libraryPanel: { uid: 'lib-uid', name: 'lib-name' },
      ...overrides,
    },
  };
}

function buildAutoGridItem(overrides: Partial<AutoGridItem['state']> = {}): AutoGridItem {
  return new AutoGridItem({
    body: new VizPanel({ key: 'panel-1', title: 'Test Panel', pluginId: 'timeseries' }),
    ...overrides,
  });
}

function buildLayoutManager(
  overrides: Partial<ConstructorParameters<typeof AutoGridLayoutManager>[0]> = {},
  children: AutoGridItem[] = []
): AutoGridLayoutManager {
  return new AutoGridLayoutManager({
    ...overrides,
    layout: new AutoGridLayout({ children }),
  });
}

describe('serializeAutoGridLayout', () => {
  describe('when the layout has no children', () => {
    it('serializes to an empty items array with layout metadata', () => {
      const layoutManager = buildLayoutManager();

      const result = serializeAutoGridLayout(layoutManager);

      expect(result).toEqual({
        kind: 'AutoGridLayout',
        spec: {
          maxColumnCount: 3,
          fillScreen: undefined,
          columnWidthMode: 'standard',
          columnWidth: undefined,
          rowHeightMode: 'standard',
          rowHeight: undefined,
          items: [],
        },
      });
    });
  });

  describe('when columnWidth and rowHeight are named strings', () => {
    it('serializes the mode fields and omits numeric values', () => {
      const layoutManager = buildLayoutManager({ columnWidth: 'narrow', rowHeight: 'tall' });

      const result = serializeAutoGridLayout(layoutManager);

      expect(result.spec).toMatchObject({
        columnWidthMode: 'narrow',
        columnWidth: undefined,
        rowHeightMode: 'tall',
        rowHeight: undefined,
      });
    });
  });

  describe('when columnWidth and rowHeight are custom numbers', () => {
    it('serializes mode as custom with the numeric values', () => {
      const layoutManager = buildLayoutManager({ columnWidth: 500, rowHeight: 250 });

      const result = serializeAutoGridLayout(layoutManager);

      expect(result.spec).toMatchObject({
        columnWidthMode: 'custom',
        columnWidth: 500,
        rowHeightMode: 'custom',
        rowHeight: 250,
      });
    });
  });

  describe('when fillScreen equals the default (false)', () => {
    it('omits fillScreen from the output', () => {
      const layoutManager = buildLayoutManager({ fillScreen: false });

      expect(serializeAutoGridLayout(layoutManager)).toBeAutoGridLayoutWith((spec) => {
        expect(spec.fillScreen).toBeUndefined();
      });
    });
  });

  describe('when fillScreen differs from the default', () => {
    it('includes fillScreen in the output', () => {
      const layoutManager = buildLayoutManager({ fillScreen: true });

      expect(serializeAutoGridLayout(layoutManager)).toBeAutoGridLayoutWith((spec) => {
        expect(spec.fillScreen).toBe(true);
      });
    });
  });

  describe('when isSnapshot is false', () => {
    it('preserves the repeat config on items', () => {
      const child = buildAutoGridItem({ variableName: 'env' });
      const layoutManager = buildLayoutManager({}, [child]);

      expect(serializeAutoGridLayout(layoutManager, false)).toBeAutoGridLayoutWith((spec) => {
        expect(spec.items).toHaveLength(1);
        expect(spec.items[0].spec.repeat).toEqual({ mode: 'variable', value: 'env' });
      });
    });
  });

  describe('when isSnapshot is true', () => {
    it('expands repeated panels and removes repeat config', () => {
      const sourcePanel = new VizPanel({ key: 'panel-1', title: 'Source', pluginId: 'timeseries' });
      const clonePanel = new VizPanel({ key: 'clone-1', title: 'Clone', pluginId: 'timeseries' });
      const child = buildAutoGridItem({
        body: sourcePanel,
        variableName: 'env',
        repeatedPanels: [clonePanel],
      });
      const layoutManager = buildLayoutManager({}, [child]);

      expect(serializeAutoGridLayout(layoutManager, true)).toBeAutoGridLayoutWith((spec) => {
        expect(spec.items).toHaveLength(2);
        expect(spec.items[0].spec.repeat).toBeUndefined();
        expect(spec.items[0].spec.element.name).toBe('panel-1');
        expect(spec.items[1].spec.element.name).toBe('clone-1');
      });
    });
  });
});

describe('serializeAutoGridItem', () => {
  describe('when the item has no variableName and no conditional rendering', () => {
    it('serializes only the element reference', () => {
      const item = buildAutoGridItem();

      const result = serializeAutoGridItem(item);

      expect(result).toEqual({
        kind: 'AutoGridLayoutItem',
        spec: {
          element: { kind: 'ElementReference', name: 'panel-1' },
        },
      });
    });
  });

  describe('when the item has a variableName', () => {
    it('includes repeat config', () => {
      const item = buildAutoGridItem({ variableName: 'region' });

      const result = serializeAutoGridItem(item);

      expect(result.spec.repeat).toEqual({ mode: 'variable', value: 'region' });
    });
  });

  describe('when the item has conditional rendering with items', () => {
    it('includes conditionalRendering in the output', () => {
      const condRendering = new ConditionalRenderingGroup({
        condition: 'and',
        visibility: 'show',
        renderHidden: false,
        conditions: [ConditionalRenderingVariable.createEmpty('myVar')],
        result: true,
      });
      const item = buildAutoGridItem({ conditionalRendering: condRendering });

      const result = serializeAutoGridItem(item);

      expect(result.spec.conditionalRendering).toBeDefined();
      expect(result.spec.conditionalRendering?.spec.items).toHaveLength(1);
    });
  });

  describe('when the item has conditional rendering with no items', () => {
    it('omits conditionalRendering from the output', () => {
      const item = buildAutoGridItem();

      const result = serializeAutoGridItem(item);

      expect(result.spec.conditionalRendering).toBeUndefined();
    });
  });
});

describe('serializeAutoGridLayout snapshot edge cases', () => {
  describe('when a snapshot child has no repeatedPanels', () => {
    it('returns only the base item without repeat', () => {
      const child = buildAutoGridItem({ variableName: 'env' });
      const layoutManager = buildLayoutManager({}, [child]);

      expect(serializeAutoGridLayout(layoutManager, true)).toBeAutoGridLayoutWith((spec) => {
        expect(spec.items).toHaveLength(1);
        expect(spec.items[0].spec.repeat).toBeUndefined();
      });
    });
  });

  describe('when a snapshot child has repeatedPanels', () => {
    it('returns the base item plus one entry per clone', () => {
      const sourcePanel = new VizPanel({ key: 'panel-1', title: 'Source', pluginId: 'timeseries' });
      const clone1 = new VizPanel({ key: 'clone-1', title: 'Clone 1', pluginId: 'timeseries' });
      const clone2 = new VizPanel({ key: 'clone-2', title: 'Clone 2', pluginId: 'timeseries' });
      const child = buildAutoGridItem({
        body: sourcePanel,
        variableName: 'env',
        repeatedPanels: [clone1, clone2],
      });
      const layoutManager = buildLayoutManager({}, [child]);

      expect(serializeAutoGridLayout(layoutManager, true)).toBeAutoGridLayoutWith((spec) => {
        expect(spec.items).toHaveLength(3);
        expect(spec.items.map((item) => item.spec.element.name)).toEqual(['panel-1', 'clone-1', 'clone-2']);
      });
    });
  });

  describe('when a snapshot clone has no key', () => {
    it('throws an error', () => {
      const sourcePanel = new VizPanel({ key: 'panel-1', title: 'Source', pluginId: 'timeseries' });
      const cloneWithoutKey = new VizPanel({ title: 'No key', pluginId: 'timeseries' });
      cloneWithoutKey.setState({ key: undefined });
      const child = buildAutoGridItem({
        body: sourcePanel,
        variableName: 'env',
        repeatedPanels: [cloneWithoutKey],
      });
      const layoutManager = buildLayoutManager({}, [child]);

      expect(() => serializeAutoGridLayout(layoutManager, true)).toThrow(
        'Snapshot serialization expected repeat clone to have a key'
      );
    });
  });
});

describe('deserializeAutoGridLayout', () => {
  describe('when layout kind is not AutoGridLayout', () => {
    it('throws an error', () => {
      const layout: DashboardV2Spec['layout'] = {
        kind: 'GridLayout',
        spec: { items: [] },
      };

      expect(() => deserializeAutoGridLayout(layout, {}, false)).toThrow('Invalid layout kind');
    });
  });

  describe('when items are empty', () => {
    it('returns an AutoGridLayoutManager with no children', () => {
      const layout: DashboardV2Spec['layout'] = {
        kind: 'AutoGridLayout',
        spec: { columnWidthMode: 'standard', rowHeightMode: 'standard', maxColumnCount: 3, items: [] },
      };

      const result = deserializeAutoGridLayout(layout, {}, false);

      expect(result).toBeInstanceOf(AutoGridLayoutManager);
      expect(result.state.layout.state.children).toHaveLength(0);
    });
  });

  describe('when columnWidthMode is custom', () => {
    it('uses the numeric columnWidth value', () => {
      const layout: DashboardV2Spec['layout'] = {
        kind: 'AutoGridLayout',
        spec: {
          columnWidthMode: 'custom',
          columnWidth: 600,
          rowHeightMode: 'standard',
          maxColumnCount: 3,
          items: [],
        },
      };

      const result = deserializeAutoGridLayout(layout, {}, false);

      expect(result.state.columnWidth).toBe(600);
    });
  });

  describe('when columnWidthMode is a named string', () => {
    it('uses the named string as columnWidth', () => {
      const layout: DashboardV2Spec['layout'] = {
        kind: 'AutoGridLayout',
        spec: { columnWidthMode: 'wide', rowHeightMode: 'standard', maxColumnCount: 3, items: [] },
      };

      const result = deserializeAutoGridLayout(layout, {}, false);

      expect(result.state.columnWidth).toBe('wide');
    });
  });

  describe('when rowHeightMode is custom', () => {
    it('uses the numeric rowHeight value', () => {
      const layout: DashboardV2Spec['layout'] = {
        kind: 'AutoGridLayout',
        spec: {
          columnWidthMode: 'standard',
          rowHeightMode: 'custom',
          rowHeight: 400,
          maxColumnCount: 3,
          items: [],
        },
      };

      const result = deserializeAutoGridLayout(layout, {}, false);

      expect(result.state.rowHeight).toBe(400);
    });
  });

  describe('when rowHeightMode is a named string', () => {
    it('uses the named string as rowHeight', () => {
      const layout: DashboardV2Spec['layout'] = {
        kind: 'AutoGridLayout',
        spec: { columnWidthMode: 'standard', rowHeightMode: 'short', maxColumnCount: 3, items: [] },
      };

      const result = deserializeAutoGridLayout(layout, {}, false);

      expect(result.state.rowHeight).toBe('short');
    });
  });

  describe('when fillScreen is undefined', () => {
    it('defaults to false', () => {
      const layout: DashboardV2Spec['layout'] = {
        kind: 'AutoGridLayout',
        spec: { columnWidthMode: 'standard', rowHeightMode: 'standard', maxColumnCount: 3, items: [] },
      };

      const result = deserializeAutoGridLayout(layout, {}, false);

      expect(result.state.fillScreen).toBe(false);
    });
  });

  describe('when a panelIdGenerator is provided', () => {
    it('uses the generator for panel IDs', () => {
      let nextId = 100;
      const panelIdGenerator = () => nextId++;
      const panel = buildPanel({ id: 1 });
      const elements: DashboardV2Spec['elements'] = { 'panel-1': panel };
      const layout: DashboardV2Spec['layout'] = {
        kind: 'AutoGridLayout',
        spec: {
          columnWidthMode: 'standard',
          rowHeightMode: 'standard',
          maxColumnCount: 3,
          items: [
            {
              kind: 'AutoGridLayoutItem',
              spec: { element: { kind: 'ElementReference', name: 'panel-1' } },
            },
          ],
        },
      };

      const result = deserializeAutoGridLayout(layout, elements, false, panelIdGenerator);

      expect(result.state.layout.state.children[0].state.key).toBe('grid-item-100');
    });
  });
});

describe('deserializeAutoGridItem', () => {
  describe('when the element is not found in elements', () => {
    it('throws an error', () => {
      const item: AutoGridLayoutItemKind = {
        kind: 'AutoGridLayoutItem',
        spec: { element: { kind: 'ElementReference', name: 'missing-panel' } },
      };

      expect(() => deserializeAutoGridItem(item, {})).toThrow(
        'Panel with uid missing-panel not found in the dashboard elements'
      );
    });
  });

  describe('when the element is a PanelKind', () => {
    it('builds a VizPanel and wraps it in an AutoGridItem', () => {
      const panel = buildPanel({ id: 5, title: 'My Panel' });
      const elements: DashboardV2Spec['elements'] = { 'panel-5': panel };
      const item: AutoGridLayoutItemKind = {
        kind: 'AutoGridLayoutItem',
        spec: { element: { kind: 'ElementReference', name: 'panel-5' } },
      };

      expect(deserializeAutoGridItem(item, elements)).toBeAutoGridItemWith((result) => {
        expect(result.state.body.state.title).toBe('My Panel');
        expect(result.state.key).toBe('grid-item-5');
      });
    });
  });

  describe('when the element is a LibraryPanelKind', () => {
    it('builds a library panel and wraps it in an AutoGridItem', () => {
      const libPanel = buildLibraryPanel({ id: 7, title: 'Lib Panel' });
      const elements: DashboardV2Spec['elements'] = { 'lib-7': libPanel };
      const item: AutoGridLayoutItemKind = {
        kind: 'AutoGridLayoutItem',
        spec: { element: { kind: 'ElementReference', name: 'lib-7' } },
      };

      expect(deserializeAutoGridItem(item, elements)).toBeAutoGridItemWith((result) => {
        expect(result.state.body.state.title).toBe('Lib Panel');
        expect(result.state.key).toBe('grid-item-7');
      });
    });
  });

  describe('when the item has repeat config', () => {
    it('sets variableName on the AutoGridItem', () => {
      const panel = buildPanel({ id: 3 });
      const elements: DashboardV2Spec['elements'] = { 'panel-3': panel };
      const item: AutoGridLayoutItemKind = {
        kind: 'AutoGridLayoutItem',
        spec: {
          element: { kind: 'ElementReference', name: 'panel-3' },
          repeat: { mode: 'variable', value: 'host' },
        },
      };

      const result = deserializeAutoGridItem(item, elements);

      expect(result.state.variableName).toBe('host');
    });
  });
});
