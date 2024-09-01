import { Registry } from '@grafana/data';

import { CanvasLayoutManager } from './CanvasLayout/CanvasLayoutManager';
import { DefaultGridLayoutManager } from './DefaultGridLayoutManager';
import { ResponsiveGridLayoutManager } from './ResponsiveGridLayoutManager';
import { TabsLayoutManager } from './TabsLayoutManager';
import { LayoutRegistryItem } from './types';

export const layoutRegistry: Registry<LayoutRegistryItem> = new Registry<LayoutRegistryItem>(() => {
  return [
    DefaultGridLayoutManager.getDescriptor(),
    ResponsiveGridLayoutManager.getDescriptor(),
    CanvasLayoutManager.getDescriptor(),
    TabsLayoutManager.getDescriptor(),
  ];
});
