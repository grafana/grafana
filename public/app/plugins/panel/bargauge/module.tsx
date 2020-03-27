import { sharedSingleStatPanelChangedHandler } from '@grafana/ui';
import { PanelPlugin } from '@grafana/data';
import { BarGaugePanel } from './BarGaugePanel';
import { BarGaugeOptions, defaults } from './types';
import { standardFieldConfig } from '../stat/types';
import { BarGaugePanelEditor } from './BarGaugePanelEditor';
import { barGaugePanelMigrationHandler } from './BarGaugeMigrations';

export const plugin = new PanelPlugin<BarGaugeOptions>(BarGaugePanel)
  .setDefaults(defaults)
  .setEditor(BarGaugePanelEditor)
  .setFieldConfigDefaults(standardFieldConfig)
  .setPanelOptions(builder => {
    /* addStandardSingleValueOptions(builder); */

    builder.addRadio({
      id: 'orientation',
      name: 'Orientation',
      description: 'Stacking direction for multiple bars',
      settings: {
        options: [
          { value: 'auto', label: 'Auto' },
          { value: 'horizontal', label: 'Horizontal' },
          { value: 'vertical', label: 'Vertical' },
        ],
      },
    });
  })
  .setPanelChangeHandler(sharedSingleStatPanelChangedHandler)
  .setMigrationHandler(barGaugePanelMigrationHandler);
