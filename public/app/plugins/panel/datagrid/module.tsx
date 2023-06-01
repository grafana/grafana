import { PanelPlugin } from '@grafana/data';
import {
  Options,
  defaultOptions,
} from '@grafana/schema/src/raw/composable/datagrid/panelcfg/x/DatagridPanelCfg_types.gen';

import { DataGridPanel } from './DataGridPanel';

export const plugin = new PanelPlugin<Options>(DataGridPanel).setPanelOptions((builder, context) => {
  const seriesOptions = context.data.map((frame, idx) => ({ value: idx, label: frame.refId }));

  if (
    context.options &&
    !seriesOptions.map((s: { value: number }) => s.value).includes(context.options.selectedSeries ?? 0)
  ) {
    context.options.selectedSeries = defaultOptions.selectedSeries!;
  }

  return builder.addSelect({
    path: 'selectedSeries',
    name: 'Select series',
    defaultValue: defaultOptions.selectedSeries,
    settings: {
      options: seriesOptions,
    },
  });
});
