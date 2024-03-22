import { PanelPlugin } from '@grafana/data';
import { config } from '@grafana/runtime';
import { commonOptionsBuilder } from '@grafana/ui';

import { SeriesEditor } from './SeriesEditor';
import { XYChartPanel2 } from './XYChartPanel';
import { getScatterFieldConfig } from './config';
import { xyChartMigrationHandler } from './migrations';
import { plugin as oldPlugin } from './old/module';
import { FieldConfig, defaultFieldConfig, Options } from './panelcfg.gen';

const useOld = Boolean(config.featureToggles.autoMigrateXYChartPanel);

let _plugin: PanelPlugin;

if (useOld) {
  _plugin = oldPlugin;
} else {
  _plugin = new PanelPlugin<Options, FieldConfig>(XYChartPanel2)
    // .setPanelChangeHandler(xyChartChangeHandler)
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

export const plugin = _plugin;
