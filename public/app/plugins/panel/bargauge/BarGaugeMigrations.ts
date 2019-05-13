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
  if (panel.pluginVersion && panel.pluginVersion.startsWith('6.2')) {
    const old = panel.options as any;
    const { fieldOptions } = old;
    if (fieldOptions) {
      const { mappings, thresholds, ...rest } = fieldOptions;
      rest.default = {
        mappings,
        thresholds: migrateOldThresholds(thresholds),
        ...rest.defaults,
      };
      return {
        ...old.options,
        fieldOptions: rest,
      };
    }
  }

  // Default to the standard migration path
  return sharedSingleStatMigrationCheck(panel);
};
