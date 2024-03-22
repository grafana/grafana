import { PanelPlugin } from '@grafana/data';
import { config } from '@grafana/runtime';
import { commonOptionsBuilder } from '@grafana/ui';

import { AutoEditor } from './AutoEditor';
import { ManualEditor } from './ManualEditor';
import { XYChartPanel } from './XYChartPanel';
import { getScatterFieldConfig } from './config';
import { Options, FieldConfig, defaultFieldConfig } from './panelcfg.gen';
import { initV2 } from './v2/module';

export const plugin = new PanelPlugin<Options, FieldConfig>(XYChartPanel);

// Delay initialization so we can use feature toggles
function initPlugin() {
  if (config.featureToggles.autoMigrateXYChartPanel) {
    initV2(plugin);
    return;
  }

  plugin.useFieldConfig(getScatterFieldConfig(defaultFieldConfig)).setPanelOptions((builder) => {
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

    commonOptionsBuilder.addTooltipOptions(builder, true);
    commonOptionsBuilder.addLegendOptions(builder);
  });
}

// This runs after feature toggles are enabled
initPlugin();
