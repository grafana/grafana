import { PanelModel } from '@grafana/ui';
import { sharedSingleStatMigrationCheck } from '@grafana/ui/src/components/SingleStatShared/SingleStatBaseOptions';
import { BarGaugeOptions } from './types';

export const barGaugePanelMigrationCheck = (panel: PanelModel<BarGaugeOptions>): Partial<BarGaugeOptions> => {
  return sharedSingleStatMigrationCheck(panel);
};
