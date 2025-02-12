import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { LayoutManagerSerializer } from '../../scene/types/DashboardLayoutManager';

import { layoutSerializerRegistry } from './layoutSerializerRegistry';
import { getLayout } from './utils';

export class TabsLayoutSerializer implements LayoutManagerSerializer {
  serialize(layoutManager: TabsLayoutManager): DashboardV2Spec['layout'] {
    return {
      kind: 'TabsLayout',
      spec: {
        tabs: layoutManager.state.tabs.map((tab) => {
          const layout = getLayout(tab.state.layout);
          if (layout.kind === 'TabsLayout') {
            throw new Error('Nested TabsLayout is not supported');
          }
          return {
            kind: 'TabItem',
            spec: {
              title: tab.state.title ?? '',
              layout: layout,
            },
          };
        }),
      },
    };
  }

  deserialize(
    layout: DashboardV2Spec['layout'],
    elements: DashboardV2Spec['elements'],
    preload: boolean
  ): TabsLayoutManager {
    if (layout.kind !== 'RowsLayout') {
      throw new Error('Invalid layout kind');
    }
    const tabs = layout.spec.rows.map((row) => {
      const layout = row.spec.layout;
      return new TabItem({
        title: row.spec.title,
        layout: layoutSerializerRegistry.get(layout.kind).serializer.deserialize(layout, elements, preload),
      });
    });
    return new TabsLayoutManager({ tabs, currentTab: tabs[0] });
  }
}
