import { PanelModel } from '@grafana/ui';
import { GaugeOptions } from './types';
import { sharedSingleStatMigrationCheck } from '@grafana/ui/src/components/SingleStatShared/SingleStatBaseOptions';

export const gaugePanelMigrationCheck = (panel: PanelModel<GaugeOptions>): Partial<GaugeOptions> => {
  return sharedSingleStatMigrationCheck(panel);
};
