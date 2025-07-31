import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';

import { deserializeTabsLayout } from './TabsLayoutSerializer';

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
});
