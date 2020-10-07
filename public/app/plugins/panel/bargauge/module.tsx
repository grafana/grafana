import { sharedSingleStatPanelChangedHandler } from '@grafana/ui';
import { PanelPlugin } from '@grafana/data';
import { BarGaugePanel } from './BarGaugePanel';
import { BarGaugeOptions, displayModes } from './types';
import { addFixexAlignmentOptions, addStandardDataReduceOptions } from '../stat/types';
import { barGaugePanelMigrationHandler } from './BarGaugeMigrations';

export const plugin = new PanelPlugin<BarGaugeOptions>(BarGaugePanel)
  .useFieldConfig()
  .setPanelOptions(builder => {
    addStandardDataReduceOptions(builder);
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
      });

    // Add a "Text Size" section
    addFixexAlignmentOptions(builder);
  })
  .setPanelChangeHandler(sharedSingleStatPanelChangedHandler)
  .setMigrationHandler(barGaugePanelMigrationHandler);
