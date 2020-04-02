import { sharedSingleStatPanelChangedHandler } from '@grafana/ui';
import { PanelPlugin } from '@grafana/data';
import { BarGaugePanel } from './BarGaugePanel';
import { BarGaugeOptions, defaults } from './types';
import { addStandardDataReduceOptions } from '../stat/types';
import { BarGaugePanelEditor } from './BarGaugePanelEditor';
import { barGaugePanelMigrationHandler } from './BarGaugeMigrations';

export const plugin = new PanelPlugin<BarGaugeOptions>(BarGaugePanel)
  .setDefaults(defaults)
  .setEditor(BarGaugePanelEditor)
  .setFieldConfigOptions()
  .setPanelOptions(builder => {
    addStandardDataReduceOptions(builder);

    builder
      .addRadio({
        id: 'displayMode',
        name: 'Display mode',
        description: 'Controls the bar style',
        settings: {
          options: [
            { value: 'basic', label: 'Basic' },
            { value: 'gradient', label: 'Gradient' },
            { value: 'lcd', label: 'Retro LCD' },
          ],
        },
      })
      .addBooleanSwitch({
        id: 'showUnfilled',
        name: 'Show unfilled area',
        description: 'When enabled renders the unfilled region as gray',
      });
  })
  .setPanelChangeHandler(sharedSingleStatPanelChangedHandler)
  .setMigrationHandler(barGaugePanelMigrationHandler);
