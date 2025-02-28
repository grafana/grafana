import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { ResponsiveGridLayoutManager } from '../../scene/layout-responsive-grid/ResponsiveGridLayoutManager';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';

import { TabsLayoutSerializer } from './TabsLayoutSerializer';

describe('deserialization', () => {
  it('should deserialize tabs layout with row child', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'TabsLayout',
      spec: {
        tabs: [{ kind: 'TabsLayoutTab', spec: { title: 'Tab 1', layout: { kind: 'RowsLayout', spec: { rows: [] } } } }],
      },
    };
    const serializer = new TabsLayoutSerializer();
    const deserialized = serializer.deserialize(layout, {}, false);
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
            spec: { title: 'Tab 1', layout: { kind: 'ResponsiveGridLayout', spec: { row: '', col: '', items: [] } } },
          },
        ],
      },
    };
    const serializer = new TabsLayoutSerializer();
    const deserialized = serializer.deserialize(layout, {}, false);
    expect(deserialized).toBeInstanceOf(TabsLayoutManager);
    expect(deserialized.state.tabs[0].state.layout).toBeInstanceOf(ResponsiveGridLayoutManager);
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
    const serializer = new TabsLayoutSerializer();
    const deserialized = serializer.deserialize(layout, {}, false);
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
            spec: { title: 'Tab 1', layout: { kind: 'ResponsiveGridLayout', spec: { row: '', col: '', items: [] } } },
          },
          { kind: 'TabsLayoutTab', spec: { title: 'Tab 2', layout: { kind: 'GridLayout', spec: { items: [] } } } },
        ],
      },
    };
    const serializer = new TabsLayoutSerializer();
    const deserialized = serializer.deserialize(layout, {}, false);
    expect(deserialized).toBeInstanceOf(TabsLayoutManager);
    expect(deserialized.state.tabs[0].state.layout).toBeInstanceOf(ResponsiveGridLayoutManager);
    expect(deserialized.state.tabs[1].state.layout).toBeInstanceOf(DefaultGridLayoutManager);
  });

  it('should handle 0 tabs', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'TabsLayout',
      spec: {
        tabs: [],
      },
    };
    const serializer = new TabsLayoutSerializer();
    const deserialized = serializer.deserialize(layout, {}, false);
    expect(deserialized).toBeInstanceOf(TabsLayoutManager);
    expect(deserialized.state.tabs).toHaveLength(0);
  });
});
