import { Registry, RegistryItem } from '@grafana/data';

import { LayoutManagerSerializer } from '../../scene/types/DashboardLayoutManager';

import { DefaultGridLayoutManagerSerializer } from './DefaultGridLayoutSerializer';
import { ResponsiveGridLayoutSerializer } from './ResponsiveGridLayoutSerializer';
import { RowsLayoutSerializer } from './RowsLayoutSerializer';
import { TabsLayoutSerializer } from './TabsLayoutSerializer';

interface LayoutSerializerRegistryItem extends RegistryItem {
  serializer: LayoutManagerSerializer;
}

export const layoutSerializerRegistry: Registry<LayoutSerializerRegistryItem> =
  new Registry<LayoutSerializerRegistryItem>(() => {
    return [
      { id: 'GridLayout', name: 'Grid Layout', serializer: new DefaultGridLayoutManagerSerializer() },
      { id: 'ResponsiveGridLayout', name: 'Responsive Grid Layout', serializer: new ResponsiveGridLayoutSerializer() },
      { id: 'RowsLayout', name: 'Rows Layout', serializer: new RowsLayoutSerializer() },
      { id: 'TabsLayout', name: 'Tabs Layout', serializer: new TabsLayoutSerializer() },
    ];
  });
