import { PanelModel } from '@grafana/data';
import { sharedSingleStatMigrationHandler } from '@grafana/ui';

import { PanelOptions } from './models.gen';

export const barGaugePanelMigrationHandler = (panel: PanelModel<PanelOptions>): Partial<PanelOptions> => {
  return sharedSingleStatMigrationHandler(panel);
};
