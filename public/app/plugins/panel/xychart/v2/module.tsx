import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';

import { SeriesEditor } from './SeriesEditor';
import { XYChartPanel2 } from './XYChartPanel';
import { getScatterFieldConfig } from './config';
import { xyChartMigrationHandler } from './migrations';
import { defaultFieldConfig } from './panelcfg.gen';

export function initV2(plugin: PanelPlugin) {
  // Change the entry point
  plugin.panel = XYChartPanel2;

  // And all the new handler stuff
  plugin
    .setPanelChangeHandler(xyChartMigrationHandler)
    .setMigrationHandler(xyChartMigrationHandler)
    .useFieldConfig(getScatterFieldConfig(defaultFieldConfig))
    .setPanelOptions((builder) => {
      builder
        .addRadio({
          path: 'mapping',
          name: 'Series mapping',
          defaultValue: 'auto',
          settings: {
            options: [
              { value: 'auto', label: 'Auto' },
              { value: 'manual', label: 'Manual' },
            ],
          },
        })
        .addCustomEditor({
          id: 'series',
          path: 'series',
          name: '',
          editor: SeriesEditor,
          defaultValue: [{}],
        });

      commonOptionsBuilder.addTooltipOptions(builder, true);
      commonOptionsBuilder.addLegendOptions(builder);
    });
}
