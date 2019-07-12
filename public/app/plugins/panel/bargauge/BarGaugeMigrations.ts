import { PanelModel } from '@grafana/ui';
import {
  sharedSingleStatMigrationCheck,
  migrateOldThresholds,
} from '@grafana/ui/src/components/SingleStatShared/SingleStatBaseOptions';
import { BarGaugeOptions } from './types';

export const barGaugePanelMigrationCheck = (panel: PanelModel<BarGaugeOptions>): Partial<BarGaugeOptions> => {
  if (!panel.options) {
    // This happens on the first load or when migrating from angular
    return {};
  }

  // Move thresholds to field
  const previousVersion = panel.pluginVersion || '';
  if (previousVersion.startsWith('6.2') || previousVersion.startsWith('6.3')) {
    console.log('TRANSFORM', panel.options);
    const old = panel.options as any;
    const { fieldOptions } = old;
    if (fieldOptions) {
      const { mappings, thresholds, ...rest } = fieldOptions;
      rest.defaults = {
        mappings,
        thresholds: migrateOldThresholds(thresholds),
        ...rest.defaults,
      };
      return {
        ...old,
        fieldOptions: rest,
      };
    }
  }

  // Default to the standard migration path
  return sharedSingleStatMigrationCheck(panel);
};
