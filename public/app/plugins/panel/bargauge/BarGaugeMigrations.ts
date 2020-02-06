import { PanelModel } from '@grafana/data';
import { sharedSingleStatMigrationHandler } from '@grafana/ui';
import { BarGaugeOptions } from './types';

export const barGaugePanelMigrationHandler = (panel: PanelModel<BarGaugeOptions>): Partial<BarGaugeOptions> => {
  return sharedSingleStatMigrationHandler(panel);
};
