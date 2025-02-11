import { PanelPlugin } from '@grafana/data';
import { BarGaugeSizing, VizOrientation } from '@grafana/schema';
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
      .addRadio({
        path: 'sizing',
        name: 'Gauge size',
        settings: {
          options: [
            { value: BarGaugeSizing.Auto, label: 'Auto' },
            { value: BarGaugeSizing.Manual, label: 'Manual' },
          ],
        },
        defaultValue: defaultOptions.sizing,
        showIf: (options: Options) => options.orientation !== VizOrientation.Auto,
      })
      .addSliderInput({
        path: 'minVizWidth',
        name: 'Min width',
        description: 'Minimum column width (vertical orientation)',
        defaultValue: defaultOptions.minVizWidth,
        settings: {
          min: 0,
          max: 600,
          step: 1,
        },
        showIf: (options: Options) =>
          options.sizing === BarGaugeSizing.Manual && options.orientation === VizOrientation.Vertical,
      })
      .addSliderInput({
        path: 'minVizHeight',
        name: 'Min height',
        description: 'Minimum row height (horizontal orientation)',
        defaultValue: defaultOptions.minVizHeight,
        settings: {
          min: 0,
          max: 600,
          step: 1,
        },
        showIf: (options: Options) =>
          options.sizing === BarGaugeSizing.Manual && options.orientation === VizOrientation.Horizontal,
      });

    commonOptionsBuilder.addTextSizeOptions(builder);
  })
  .setPanelChangeHandler(gaugePanelChangedHandler)
  .setSuggestionsSupplier(new GaugeSuggestionsSupplier())
  .setMigrationHandler(gaugePanelMigrationHandler);
