import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';

import { getScatterFieldConfig } from './config';
import { xyChartMigrationHandler } from './migrations';
import { FieldConfig, defaultFieldConfig } from './panelcfg.gen';
import { Options } from './types2';
import { SeriesEditor } from './v2/SeriesEditor';
import { XYChartPanel2 } from './v2/XYChartPanel';

export const plugin = new PanelPlugin<Options, FieldConfig>(XYChartPanel2)
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
