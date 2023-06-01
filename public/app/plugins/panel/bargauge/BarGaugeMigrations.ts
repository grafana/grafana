import { PanelModel } from '@grafana/data';
import { Options } from '@grafana/schema/src/raw/composable/bargauge/panelcfg/x/BarGaugePanelCfg_types.gen';
import { sharedSingleStatMigrationHandler } from '@grafana/ui';

export const barGaugePanelMigrationHandler = (panel: PanelModel<Options>): Partial<Options> => {
  return sharedSingleStatMigrationHandler(panel);
};
