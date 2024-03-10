import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';

import { ManualEditor } from './ManualEditor';
import { getScatterFieldConfig } from './config';
import { xyChartMigrationHandler } from './migrations';
import { FieldConfig, defaultFieldConfig } from './panelcfg.gen';
import { Options } from './types2';
import { AutoEditor } from './v2/AutoEditor';
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
            { value: 'auto', label: 'Auto', description: 'Automatically plot values across multiple tables' },
            { value: 'manual', label: 'Manual', description: 'Plot values explicitly from any result' },
          ],
        },
      })
      .addCustomEditor({
        id: 'series',
        path: 'series',
        name: '',
        editor: AutoEditor,
        defaultValue: [{}],
        showIf: (cfg) => cfg.mapping === 'auto',
      })
      .addCustomEditor({
        id: 'series',
        path: 'series',
        name: '',
        defaultValue: [],
        editor: ManualEditor,
        showIf: (cfg) => cfg.mapping === 'manual',
      });

    commonOptionsBuilder.addTooltipOptions(builder, true);
    commonOptionsBuilder.addLegendOptions(builder);
  });
