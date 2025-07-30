import { Registry, RegistryItem } from '@grafana/data';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { DashboardLayoutManager } from '../../scene/types/DashboardLayoutManager';

import { deserializeAutoGridLayout } from './AutoGridLayoutSerializer';
import { deserializeDefaultGridLayout } from './DefaultGridLayoutSerializer';
import { deserializeRowsLayout } from './RowsLayoutSerializer';
import { deserializeTabsLayout } from './TabsLayoutSerializer';

interface LayoutSerializerRegistryItem extends RegistryItem {
  deserialize: (
    layout: DashboardV2Spec['layout'],
    elements: DashboardV2Spec['elements'],
    preload: boolean,
    panelIdGenerator?: () => number
  ) => DashboardLayoutManager;
}

export const layoutDeserializerRegistry: Registry<LayoutSerializerRegistryItem> =
  new Registry<LayoutSerializerRegistryItem>(() => {
    return [
      {
        id: 'GridLayout',
        name: 'Grid Layout',
        deserialize: deserializeDefaultGridLayout,
      },
      {
        id: 'AutoGridLayout',
        name: 'Auto Grid Layout',
        deserialize: deserializeAutoGridLayout,
      },
      {
        id: 'RowsLayout',
        name: 'Rows Layout',
        deserialize: deserializeRowsLayout,
      },
      {
        id: 'TabsLayout',
        name: 'Tabs Layout',
        deserialize: deserializeTabsLayout,
      },
    ];
  });
