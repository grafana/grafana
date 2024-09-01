import { Registry } from '@grafana/data';

import { AutomaticGridLayoutManager } from './AutomaticGridLayoutManager';
import { CanvasLayoutManager } from './CanvasLayout/CanvasLayoutManager';
import { ManualGridLayoutManager } from './ManualGridLayoutWrapper';
import { TabsLayoutManager } from './TabsLayoutManager';
import { LayoutRegistryItem } from './types';

export const layoutRegistry: Registry<LayoutRegistryItem> = new Registry<LayoutRegistryItem>(() => {
  return [
    ManualGridLayoutManager.getDescriptor(),
    AutomaticGridLayoutManager.getDescriptor(),
    CanvasLayoutManager.getDescriptor(),
    TabsLayoutManager.getDescriptor(),
  ];
});
