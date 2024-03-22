import { PanelOptionsBuilders } from '@grafana/scenes';
import { SortOrder } from '@grafana/schema/dist/esm/index';
import { TooltipDisplayMode } from '@grafana/ui';

export const breakdownPanelOptions = PanelOptionsBuilders.timeseries()
  .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending, maxHeight: 250 })
  .setOption('legend', { showLegend: false })
  .build();
