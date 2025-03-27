import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';

import { layoutDeserializerRegistry } from './layoutSerializerRegistry';

export function serializeTabsLayout(layoutManager: TabsLayoutManager): DashboardV2Spec['layout'] {
  return {
    kind: 'TabsLayout',
    spec: {
      tabs: layoutManager.state.tabs.map((tab) => {
        const layout = tab.state.layout.serialize();
        return {
          kind: 'TabsLayoutTab',
          spec: {
            title: tab.state.title,
            layout: layout,
          },
        };
      }),
    },
  };
}

export function deserializeTabsLayout(
  layout: DashboardV2Spec['layout'],
  elements: DashboardV2Spec['elements'],
  preload: boolean
): TabsLayoutManager {
  if (layout.kind !== 'TabsLayout') {
    throw new Error('Invalid layout kind');
  }
  const tabs = layout.spec.tabs.map((tab) => {
    const layout = tab.spec.layout;
    return new TabItem({
      title: tab.spec.title,
      layout: layoutDeserializerRegistry.get(layout.kind).deserialize(layout, elements, preload),
    });
  });
  return new TabsLayoutManager({ tabs });
}
