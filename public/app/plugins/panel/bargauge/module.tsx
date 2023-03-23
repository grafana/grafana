import { PanelPlugin, VizOrientation } from '@grafana/data';
import { BarGaugeDisplayMode, BarGaugeValueMode } from '@grafana/schema';
import { commonOptionsBuilder, sharedSingleStatPanelChangedHandler } from '@grafana/ui';

import { addOrientationOption, addStandardDataReduceOptions } from '../stat/common';

import { barGaugePanelMigrationHandler } from './BarGaugeMigrations';
import { BarGaugePanel } from './BarGaugePanel';
import { Options, defaultOptions } from './panelcfg.gen';
import { BarGaugeSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options>(BarGaugePanel)
  .useFieldConfig()
  .setPanelOptions((builder) => {
    addStandardDataReduceOptions(builder);
    addOrientationOption(builder);
    commonOptionsBuilder.addTextSizeOptions(builder);

    builder
      .addRadio({
        path: 'displayMode',
        name: 'Display mode',
        settings: {
          options: [
            { value: BarGaugeDisplayMode.Gradient, label: 'Gradient' },
            { value: BarGaugeDisplayMode.Lcd, label: 'Retro LCD' },
            { value: BarGaugeDisplayMode.Basic, label: 'Basic' },
          ],
        },
        defaultValue: defaultOptions.displayMode,
      })
      .addRadio({
        path: 'valueMode',
        name: 'Value display',
        settings: {
          options: [
            { value: BarGaugeValueMode.Color, label: 'Value color' },
            { value: BarGaugeValueMode.Text, label: 'Text color' },
            { value: BarGaugeValueMode.Hidden, label: 'Hidden' },
          ],
        },
        defaultValue: defaultOptions.valueMode,
      })
      .addBooleanSwitch({
        path: 'showUnfilled',
        name: 'Show unfilled area',
        description: 'When enabled renders the unfilled region as gray',
        defaultValue: defaultOptions.showUnfilled,
        showIf: (options) => options.displayMode !== 'lcd',
      })
      .addNumberInput({
        path: 'minVizWidth',
        name: 'Min width',
        description: 'Minimum column width',
        defaultValue: defaultOptions.minVizWidth,
        showIf: (options) => options.orientation === VizOrientation.Vertical,
      })
      .addNumberInput({
        path: 'minVizHeight',
        name: 'Min height',
        description: 'Minimum row height',
        defaultValue: defaultOptions.minVizHeight,
        showIf: (options) => options.orientation === VizOrientation.Horizontal,
      });
  })
  .setPanelChangeHandler(sharedSingleStatPanelChangedHandler)
  .setMigrationHandler(barGaugePanelMigrationHandler)
  .setSuggestionsSupplier(new BarGaugeSuggestionsSupplier());
