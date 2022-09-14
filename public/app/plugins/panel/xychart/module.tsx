import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';

import { AutoEditor } from './AutoEditor';
import { ManualEditor } from './ManualEditor';
import { XYChartPanel2 } from './XYChartPanel2';
import { getScatterFieldConfig } from './config';
import { defaultScatterConfig, XYChartOptions, ScatterFieldConfig } from './models.gen';

export const plugin = new PanelPlugin<XYChartOptions, ScatterFieldConfig>(XYChartPanel2)
  .useFieldConfig(getScatterFieldConfig(defaultScatterConfig))
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        path: 'mode',
        name: 'Mode',
        defaultValue: 'auto',
        settings: {
          options: [
            { value: 'auto', label: 'Auto', description: 'No changes to saved model since 8.0' },
            { value: 'manual', label: 'Manual' },
          ],
        },
      })
      .addCustomEditor({
        id: 'xyPlotConfig',
        path: 'dims',
        name: '',
        editor: AutoEditor,
        showIf: (cfg) => cfg.mode === 'auto',
      })
      .addCustomEditor({
        id: 'series',
        path: 'series',
        name: '',
        defaultValue: [],
        editor: ManualEditor,
        showIf: (cfg) => cfg.mode === 'manual',
      });

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  });
