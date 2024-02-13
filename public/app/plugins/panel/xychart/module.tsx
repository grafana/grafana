import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';

import { AutoEditor } from './AutoEditor';
import { DynamicEditor } from './DynamicEditor';
import { ManualEditor } from './ManualEditor';
import { XYChartPanel } from './XYChartPanel';
import { getScatterFieldConfig } from './config';
import { xyChartMigrationHandler } from './migrations';
import { Options, FieldConfig, defaultFieldConfig } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options, FieldConfig>(XYChartPanel)
  .setMigrationHandler(xyChartMigrationHandler)
  .useFieldConfig(getScatterFieldConfig(defaultFieldConfig))
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        path: 'seriesMapping',
        name: 'Series mapping',
        defaultValue: 'auto',
        settings: {
          options: [
            { value: 'dynamic', label: 'Dynamic', description: 'Automatically plot values across multiple tables' },
            { value: 'auto', label: 'Table', description: 'Plot values within a single table result' },
            { value: 'manual', label: 'Manual', description: 'Plot values explicitly from any result' },
          ],
        },
      })
      .addCustomEditor({
        id: 'dynamicConfig',
        path: 'dynamicConfig',
        name: '',
        editor: DynamicEditor,
        showIf: (cfg) => cfg.seriesMapping === 'dynamic',
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

    commonOptionsBuilder.addTooltipOptions(builder, true);
    commonOptionsBuilder.addLegendOptions(builder);
  });
