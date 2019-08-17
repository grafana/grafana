import { PanelModel, VizOrientation } from '@grafana/ui';
import { FieldConfig } from '@grafana/data';
import { GaugeOptions } from './types';
import { sharedSingleStatMigrationCheck } from '@grafana/ui/src/components/SingleStatShared/SingleStatBaseOptions';

export const gaugePanelMigrationCheck = (panel: PanelModel<GaugeOptions>): Partial<GaugeOptions> => {
  if (!panel.options && (panel as any).format) {
    return migrateFromAngularSingleStat(panel);
  }

  return sharedSingleStatMigrationCheck(panel);
};

function migrateFromAngularSingleStat(panel: any): Partial<GaugeOptions> {
  const options = {
    fieldOptions: {
      defaults: {} as FieldConfig,
      override: {} as FieldConfig,
      calcs: [panel.format],
    },
    orientation: VizOrientation.Horizontal,
  };

  if (panel.gauge) {
    options.fieldOptions.defaults.min = panel.gauge.minValue;
    options.fieldOptions.defaults.max = panel.gauge.maxValue;
  }

  return options;
}
