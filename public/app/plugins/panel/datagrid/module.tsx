import { PanelPlugin } from '@grafana/data';

import { DataGridPanel } from './DataGridPanel';
import { defaultOptions, Options } from './panelcfg.gen';

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
