import { Registry } from '@grafana/data';

import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { AutoGridLayoutManager } from '../layout-responsive-grid/ResponsiveGridLayoutManager';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

export const layoutRegistry: Registry<LayoutRegistryItem> = new Registry<LayoutRegistryItem>(() => {
  return [
    DefaultGridLayoutManager.descriptor,
    AutoGridLayoutManager.descriptor,
    RowsLayoutManager.descriptor,
    TabsLayoutManager.descriptor,
  ];
});
