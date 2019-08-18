import { PanelModel, sharedSingleStatMigrationCheck } from '@grafana/ui';
import { BarGaugeOptions } from './types';

export const barGaugePanelMigrationCheck = (panel: PanelModel<BarGaugeOptions>): Partial<BarGaugeOptions> => {
  return sharedSingleStatMigrationCheck(panel);
};
