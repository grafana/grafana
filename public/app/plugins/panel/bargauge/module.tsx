import { commonOptionsBuilder, sharedSingleStatPanelChangedHandler } from '@grafana/ui';
import { PanelPlugin, VizOrientation } from '@grafana/data';
import { BarGaugePanel } from './BarGaugePanel';
import { BarGaugeOptions, displayModes } from './types';
import { addOrientationOption, addStandardDataReduceOptions } from '../stat/types';
import { barGaugePanelMigrationHandler } from './BarGaugeMigrations';
import { BarGaugeSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<BarGaugeOptions>(BarGaugePanel)
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
          options: displayModes,
        },
        defaultValue: 'gradient',
      })
      .addBooleanSwitch({
        path: 'showUnfilled',
        name: 'Show unfilled area',
        description: 'When enabled renders the unfilled region as gray',
        defaultValue: true,
        showIf: (options: BarGaugeOptions) => options.displayMode !== 'lcd',
      })
      .addNumberInput({
        path: 'minVizWidth',
        name: 'Min width',
        description: 'Minimum column width',
        defaultValue: 0,
        showIf: (options: BarGaugeOptions) => options.orientation === VizOrientation.Vertical,
      })
      .addNumberInput({
        path: 'minVizHeight',
        name: 'Min height',
        description: 'Minimum row height',
        defaultValue: 10,
        showIf: (options: BarGaugeOptions) => options.orientation === VizOrientation.Horizontal,
      });
  })
  .setPanelChangeHandler(sharedSingleStatPanelChangedHandler)
  .setMigrationHandler(barGaugePanelMigrationHandler)
  .setSuggestionsSupplier(new BarGaugeSuggestionsSupplier());
