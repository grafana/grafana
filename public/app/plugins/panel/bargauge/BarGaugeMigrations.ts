import { PanelModel } from '@grafana/ui';
import { BarGaugeOptions } from './types';
import { sharedSingleStatMigrationCheck } from '@grafana/ui/src/components/SingleStatShared/SingleStatBaseOptions';

export const barGaugePanelMigrationCheck = (panel: PanelModel<BarGaugeOptions>): Partial<BarGaugeOptions> => {
  if (!panel.options) {
    // This happens on the first load or when migrating from angular
    return {};
  }

  // Move thresholds to field
  if (panel.pluginVersion && panel.pluginVersion.startsWith('6.2')) {
    console.log('BAR migrate', panel);
    const old = panel.options as any;
    const fieldOptions = old.fieldOptions;

    if (fieldOptions && fieldOptions.thresholds) {
      if (!fieldOptions.defaults) {
        fieldOptions.defaults = {};
      }

      fieldOptions.defaults.scale = {
        thresholds: fieldOptions.thresholds.map((t: any) => {
          return { value: t.value, color: t.color }; // Drop index
        }),
      };

      delete fieldOptions.thresholds;

      return {
        ...old,
        fieldOptions,
      };
    }
  } else {
    console.log('default bar migration....', panel);
  }

  // Default to the standard migration path
  return sharedSingleStatMigrationCheck(panel);
};
