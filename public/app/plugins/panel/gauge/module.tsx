import { PanelPlugin } from '@grafana/data';
import { VizOrientation } from '@grafana/schema';
import { commonOptionsBuilder } from '@grafana/ui';

import { addOrientationOption, addStandardDataReduceOptions } from '../stat/common';

import { gaugePanelMigrationHandler, gaugePanelChangedHandler } from './GaugeMigrations';
import { GaugePanel } from './GaugePanel';
import { Options, defaultOptions } from './panelcfg.gen';
import { GaugeSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options>(GaugePanel)
  .useFieldConfig({
    useCustomConfig: (builder) => {
      builder.addNumberInput({
        path: 'neutral',
        name: 'Neutral',
        description: 'Leave empty to use Min as neutral point',
        category: ['Gauge'],
        settings: {
          placeholder: 'auto',
        },
      });
    },
  })
  .setPanelOptions((builder) => {
    addStandardDataReduceOptions(builder);
    addOrientationOption(builder);
    builder
      .addBooleanSwitch({
        path: 'showThresholdLabels',
        name: 'Show threshold labels',
        description: 'Render the threshold values around the gauge bar',
        defaultValue: defaultOptions.showThresholdLabels,
      })
      .addBooleanSwitch({
        path: 'showThresholdMarkers',
        name: 'Show threshold markers',
        description: 'Renders the thresholds as an outer bar',
        defaultValue: defaultOptions.showThresholdMarkers,
      })
      .addNumberInput({
        path: 'minVizWidth',
        name: 'Min width',
        description: 'Minimum column width',
        defaultValue: defaultOptions.minVizWidth,
        showIf: (options: Options) => options.orientation === VizOrientation.Vertical,
      })
      .addNumberInput({
        path: 'minVizHeight',
        name: 'Min height',
        description: 'Minimum row height',
        defaultValue: defaultOptions.minVizHeight,
        showIf: (options: Options) => options.orientation === VizOrientation.Horizontal,
      });

    commonOptionsBuilder.addTextSizeOptions(builder);
  })
  .setPanelChangeHandler(gaugePanelChangedHandler)
  .setSuggestionsSupplier(new GaugeSuggestionsSupplier())
  .setMigrationHandler(gaugePanelMigrationHandler);
