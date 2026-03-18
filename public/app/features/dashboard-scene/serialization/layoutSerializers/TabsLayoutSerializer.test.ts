import { SceneGridLayout } from '@grafana/scenes';
import { Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { ConditionalRenderingVariable } from '../../conditional-rendering/conditions/ConditionalRenderingVariable';
import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';

import { deserializeTabsLayout, serializeTab, serializeTabsLayout } from './TabsLayoutSerializer';
import './test-matchers';

function buildTabItem(overrides: Partial<TabItem['state']> = {}): TabItem {
  return new TabItem({
    title: 'Tab 1',
    layout: new AutoGridLayoutManager({
      layout: new AutoGridLayout({}),
    }),
    ...overrides,
  });
}

function buildTabsLayoutManager(tabs: TabItem[] = []): TabsLayoutManager {
  return new TabsLayoutManager({ tabs });
}

describe('serializeTabsLayout', () => {
  it('serializes an empty tabs layout', () => {
    const manager = buildTabsLayoutManager();

    const result = serializeTabsLayout(manager);

    expect(result).toEqual({
      kind: 'TabsLayout',
      spec: { tabs: [] },
    });
  });

  it('serializes a single tab with its title and child layout', () => {
    const tab = buildTabItem({ title: 'Overview' });
    const manager = buildTabsLayoutManager([tab]);

    expect(serializeTabsLayout(manager)).toBeTabsLayoutWith(({ tabs }) => {
      expect(tabs).toHaveLength(1);
      expect(tabs[0].spec.title).toBe('Overview');
      expect(tabs[0].spec.layout.kind).toBe('AutoGridLayout');
    });
  });

  it('serializes multiple tabs preserving order', () => {
    const tab1 = buildTabItem({ title: 'First' });
    const tab2 = buildTabItem({
      title: 'Second',
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({ children: [] }),
      }),
    });
    const manager = buildTabsLayoutManager([tab1, tab2]);

    expect(serializeTabsLayout(manager)).toBeTabsLayoutWith(({ tabs }) => {
      expect(tabs).toHaveLength(2);
      expect(tabs[0].spec.title).toBe('First');
      expect(tabs[0].spec.layout.kind).toBe('AutoGridLayout');
      expect(tabs[1].spec.title).toBe('Second');
      expect(tabs[1].spec.layout.kind).toBe('GridLayout');
    });
  });

  it('filters out tabs with repeatSourceKey', () => {
    const source = buildTabItem({ title: 'Source' });
    const clone = buildTabItem({ title: 'Clone', repeatSourceKey: 'source-key' });
    const manager = buildTabsLayoutManager([source, clone]);

    expect(serializeTabsLayout(manager)).toBeTabsLayoutWith(({ tabs }) => {
      expect(tabs).toHaveLength(1);
      expect(tabs[0].spec.title).toBe('Source');
    });
  });

  it('includes repeat config when repeatByVariable is set', () => {
    const tab = buildTabItem({ title: 'Repeated', repeatByVariable: 'env' });
    const manager = buildTabsLayoutManager([tab]);

    expect(serializeTabsLayout(manager)).toBeTabsLayoutWith(({ tabs }) => {
      expect(tabs[0].spec.repeat).toEqual({
        mode: 'variable',
        value: 'env',
      });
    });
  });
});

describe('serializeTab', () => {
  it('includes repeat config when repeatByVariable is set', () => {
    const tab = buildTabItem({ title: 'Repeated', repeatByVariable: 'region' });

    const result = serializeTab(tab);

    expect(result).toMatchObject({
      kind: 'TabsLayoutTab',
      spec: {
        title: 'Repeated',
        repeat: { mode: 'variable', value: 'region' },
      },
    });
  });

  it('omits repeat when repeatByVariable is undefined', () => {
    const tab = buildTabItem({ title: 'Static' });

    const result = serializeTab(tab);

    expect(result.spec.repeat).toBeUndefined();
  });

  it('includes conditional rendering when it has items', () => {
    const condRendering = new ConditionalRenderingGroup({
      condition: 'and',
      visibility: 'show',
      renderHidden: false,
      conditions: [ConditionalRenderingVariable.createEmpty('myVar')],
      result: true,
    });
    const tab = buildTabItem({ conditionalRendering: condRendering });

    const result = serializeTab(tab);

    expect(result.spec.conditionalRendering).toBeDefined();
    expect(result.spec.conditionalRendering?.spec.items).toHaveLength(1);
  });

  it('omits conditional rendering when it has no items', () => {
    const tab = buildTabItem();

    const result = serializeTab(tab);

    expect(result.spec.conditionalRendering).toBeUndefined();
  });
});

describe('deserializeTabsLayout', () => {
  it('throws for non-TabsLayout kind', () => {
    const layout = {
      kind: 'RowsLayout',
      spec: { rows: [] },
    } as unknown as DashboardV2Spec['layout'];

    expect(() => deserializeTabsLayout(layout, {}, false)).toThrow('Invalid layout kind');
  });

  it('deserializes tabs layout with row child', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'TabsLayout',
      spec: {
        tabs: [{ kind: 'TabsLayoutTab', spec: { title: 'Tab 1', layout: { kind: 'RowsLayout', spec: { rows: [] } } } }],
      },
    };

    const deserialized = deserializeTabsLayout(layout, {}, false);

    expect(deserialized).toBeInstanceOf(TabsLayoutManager);
    expect(deserialized.state.tabs[0].state.layout).toBeInstanceOf(RowsLayoutManager);
  });

  it('deserializes tabs layout with responsive grid child', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'TabsLayout',
      spec: {
        tabs: [
          {
            kind: 'TabsLayoutTab',
            spec: {
              title: 'Tab 1',
              layout: {
                kind: 'AutoGridLayout',
                spec: { columnWidthMode: 'standard', rowHeightMode: 'standard', maxColumnCount: 4, items: [] },
              },
            },
          },
        ],
      },
    };

    const deserialized = deserializeTabsLayout(layout, {}, false);

    expect(deserialized).toBeInstanceOf(TabsLayoutManager);
    expect(deserialized.state.tabs[0].state.layout).toBeInstanceOf(AutoGridLayoutManager);
  });

  it('deserializes tabs layout with default grid child', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'TabsLayout',
      spec: {
        tabs: [
          {
            kind: 'TabsLayoutTab',
            spec: { title: 'Tab 1', layout: { kind: 'GridLayout', spec: { items: [] } } },
          },
        ],
      },
    };

    const deserialized = deserializeTabsLayout(layout, {}, false);

    expect(deserialized).toBeInstanceOf(TabsLayoutManager);
    expect(deserialized.state.tabs[0].state.layout).toBeInstanceOf(DefaultGridLayoutManager);
  });

  it('deserializes multiple tabs preserving order', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'TabsLayout',
      spec: {
        tabs: [
          {
            kind: 'TabsLayoutTab',
            spec: {
              title: 'Tab 1',
              layout: {
                kind: 'AutoGridLayout',
                spec: { columnWidthMode: 'standard', rowHeightMode: 'standard', maxColumnCount: 4, items: [] },
              },
            },
          },
          { kind: 'TabsLayoutTab', spec: { title: 'Tab 2', layout: { kind: 'GridLayout', spec: { items: [] } } } },
        ],
      },
    };

    const deserialized = deserializeTabsLayout(layout, {}, false);

    expect(deserialized).toBeInstanceOf(TabsLayoutManager);
    expect(deserialized.state.tabs).toHaveLength(2);
    expect(deserialized.state.tabs[0].state.title).toBe('Tab 1');
    expect(deserialized.state.tabs[0].state.layout).toBeInstanceOf(AutoGridLayoutManager);
    expect(deserialized.state.tabs[1].state.title).toBe('Tab 2');
    expect(deserialized.state.tabs[1].state.layout).toBeInstanceOf(DefaultGridLayoutManager);
  });

  it('deserializes 0 tabs', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'TabsLayout',
      spec: { tabs: [] },
    };

    const deserialized = deserializeTabsLayout(layout, {}, false);

    expect(deserialized).toBeInstanceOf(TabsLayoutManager);
    expect(deserialized.state.tabs).toHaveLength(0);
  });

  it('deserializes tab with repeat config', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'TabsLayout',
      spec: {
        tabs: [
          {
            kind: 'TabsLayoutTab',
            spec: {
              title: 'Repeated',
              layout: { kind: 'GridLayout', spec: { items: [] } },
              repeat: { mode: 'variable', value: 'env' },
            },
          },
        ],
      },
    };

    const deserialized = deserializeTabsLayout(layout, {}, false);

    expect(deserialized.state.tabs[0].state.repeatByVariable).toBe('env');
  });

  it('deserializes tab with conditional rendering', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'TabsLayout',
      spec: {
        tabs: [
          {
            kind: 'TabsLayoutTab',
            spec: {
              title: 'Conditional',
              layout: { kind: 'GridLayout', spec: { items: [] } },
              conditionalRendering: {
                kind: 'ConditionalRenderingGroup',
                spec: {
                  visibility: 'show',
                  condition: 'and',
                  items: [
                    {
                      kind: 'ConditionalRenderingVariable',
                      spec: { variable: 'myVar', operator: 'equals', value: 'foo' },
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    };

    const deserialized = deserializeTabsLayout(layout, {}, false);

    const condRendering = deserialized.state.tabs[0].state.conditionalRendering;
    expect(condRendering).toBeInstanceOf(ConditionalRenderingGroup);
    expect(condRendering?.state.conditions).toHaveLength(1);
  });
});
