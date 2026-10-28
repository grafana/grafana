import { SceneVariableSet } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';

import { deserializeTabsLayout, serializeTabsLayout } from './TabsLayoutSerializer';

describe('deserialization', () => {
  it('should deserialize tabs layout with row child', () => {
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

  it('should deserialize tabs layout with responsive grid child', () => {
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

  it('should deserialize tabs layout with default grid child', () => {
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

  it('should handle multiple tabs', () => {
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
    expect(deserialized.state.tabs[0].state.layout).toBeInstanceOf(AutoGridLayoutManager);
    expect(deserialized.state.tabs[1].state.layout).toBeInstanceOf(DefaultGridLayoutManager);
  });

  it('should handle 0 tabs', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'TabsLayout',
      spec: {
        tabs: [],
      },
    };
    const deserialized = deserializeTabsLayout(layout, {}, false);
    expect(deserialized).toBeInstanceOf(TabsLayoutManager);
    expect(deserialized.state.tabs).toHaveLength(0);
  });

  it('should deserialize tab with section variables', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'TabsLayout',
      spec: {
        tabs: [
          {
            kind: 'TabsLayoutTab',
            spec: {
              title: 'Tab with vars',
              layout: { kind: 'GridLayout', spec: { items: [] } },
              variables: [
                {
                  kind: 'CustomVariable',
                  spec: {
                    name: 'env',
                    label: 'Environment',
                    query: 'dev,staging,prod',
                    current: { text: 'dev', value: 'dev' },
                    options: [],
                    multi: false,
                    includeAll: false,
                    hide: 'dontHide',
                    skipUrlSync: false,
                    allowCustomValue: true,
                  },
                },
              ],
            },
          },
        ],
      },
    };
    const deserialized = deserializeTabsLayout(layout, {}, false);

    const tab = deserialized.state.tabs[0];
    expect(tab.state.$variables).toBeInstanceOf(SceneVariableSet);
    expect(tab.state.$variables!.state.variables).toHaveLength(1);
    expect(tab.state.$variables!.state.variables[0].state.name).toBe('env');
  });

  it('should deserialize tab without section variables as undefined $variables', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'TabsLayout',
      spec: {
        tabs: [
          {
            kind: 'TabsLayoutTab',
            spec: {
              title: 'Tab without vars',
              layout: { kind: 'GridLayout', spec: { items: [] } },
            },
          },
        ],
      },
    };
    const deserialized = deserializeTabsLayout(layout, {}, false);

    const tab = deserialized.state.tabs[0];
    expect(tab.state.$variables).toBeUndefined();
  });

  it('keeps tab annotations across save and load and omits an empty list', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'TabsLayout',
      spec: {
        tabs: [
          {
            kind: 'TabsLayoutTab',
            spec: {
              title: 'Tab A',
              annotations: [sectionAnnotation('tab-a')],
              layout: { kind: 'GridLayout', spec: { items: [] } },
            },
          },
        ],
      },
    };

    const deserialized = deserializeTabsLayout(layout, {}, false);
    const tab = deserialized.state.tabs[0];
    const data = tab.state.$data;
    expect(data).toBeInstanceOf(DashboardDataLayerSet);
    expect(data instanceof DashboardDataLayerSet && data.state.annotationLayers[0].state.name).toBe('tab-a');

    const serialized = serializeTabsLayout(deserialized);
    expect(serialized.kind === 'TabsLayout' && serialized.spec.tabs[0].spec.annotations?.[0].spec.name).toBe('tab-a');

    const empty = deserializeTabsLayout(
      {
        kind: 'TabsLayout',
        spec: {
          tabs: [
            { kind: 'TabsLayoutTab', spec: { title: 'Empty', layout: { kind: 'GridLayout', spec: { items: [] } } } },
          ],
        },
      },
      {},
      false
    );
    const emptySerialized = serializeTabsLayout(empty);
    expect(emptySerialized.kind === 'TabsLayout' && emptySerialized.spec.tabs[0].spec.annotations).toBeUndefined();
    expect(empty.state.tabs[0].state.$data).toBeUndefined();
  });

  it('does not create live section layers when loading a snapshot', () => {
    const deserialized = deserializeTabsLayout(
      {
        kind: 'TabsLayout',
        spec: {
          tabs: [
            {
              kind: 'TabsLayoutTab',
              spec: {
                title: 'Tab A',
                annotations: [sectionAnnotation('tab-a')],
                layout: { kind: 'GridLayout', spec: { items: [] } },
              },
            },
          ],
        },
      },
      {},
      false,
      undefined,
      true
    );

    expect(deserialized.state.tabs[0].state.$data).toBeUndefined();
  });
});

function sectionAnnotation(name: string) {
  return {
    kind: 'AnnotationQuery' as const,
    spec: {
      name,
      enable: true,
      hide: false,
      iconColor: 'red',
      query: { kind: 'DataQuery' as const, group: 'grafana', version: 'v0', spec: {} },
    },
  };
}
