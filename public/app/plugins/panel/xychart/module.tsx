import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';

import { AutoEditor } from './AutoEditor';
import { ManualEditor } from './ManualEditor';
import { XYChartPanel2 } from './XYChartPanel2';
import { getScatterFieldConfig } from './config';
import { Options, FieldConfig, defaultFieldConfig } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options, FieldConfig>(XYChartPanel2)
  .useFieldConfig(getScatterFieldConfig(defaultFieldConfig))
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        path: 'seriesMapping',
        name: 'Series mapping',
        defaultValue: 'auto',
        settings: {
          options: [
            { value: 'auto', label: 'Table', description: 'Plot values within a single table result' },
            { value: 'manual', label: 'Manual', description: 'Construct values from any result' },
          ],
        },
      })
      .addCustomEditor({
        id: 'xyPlotConfig',
        path: 'dims',
        name: '',
        editor: AutoEditor,
        showIf: (cfg) => cfg.seriesMapping === 'auto',
      })
      .addCustomEditor({
        id: 'series',
        path: 'series',
        name: '',
        defaultValue: [],
        editor: ManualEditor,
        showIf: (cfg) => cfg.seriesMapping === 'manual',
      });

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  });
