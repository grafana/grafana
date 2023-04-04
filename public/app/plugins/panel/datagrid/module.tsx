import { PanelPlugin } from '@grafana/data';

import { DataGridPanel } from './DataGridPanel';
import { defaultPanelOptions, PanelOptions } from './panelcfg.gen';

export const plugin = new PanelPlugin<PanelOptions>(DataGridPanel).setPanelOptions((builder, context) => {
  const seriesOptions = context.data.map((frame, idx) => ({ value: idx, label: frame.refId }));

  if (
    context.options &&
    !seriesOptions.map((s: { value: number }) => s.value).includes(context.options.selectedSeries ?? 0)
  ) {
    context.options.selectedSeries = defaultPanelOptions.selectedSeries!;
  }

  return builder.addSelect({
    path: 'selectedSeries',
    name: 'Select series',
    defaultValue: defaultPanelOptions.selectedSeries,
    settings: {
      options: seriesOptions,
    },
  });
});
