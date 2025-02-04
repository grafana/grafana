import { Registry } from '@grafana/data';

import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { ResponsiveGridLayoutManager } from '../layout-responsive-grid/ResponsiveGridLayoutManager';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { LayoutRegistryItem } from '../types';

export const layoutRegistry: Registry<LayoutRegistryItem> = new Registry<LayoutRegistryItem>(() => {
  return [
    DefaultGridLayoutManager.getDescriptor(),
    ResponsiveGridLayoutManager.getDescriptor(),
    RowsLayoutManager.getDescriptor(),
  ];
});
