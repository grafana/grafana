import type { PanelModel } from '@grafana/data/types';
import { sharedSingleStatMigrationHandler } from '@grafana/ui';

import { type Options } from './panelcfg.gen';

export const barGaugePanelMigrationHandler = (panel: PanelModel<Options>): Partial<Options> => {
  return sharedSingleStatMigrationHandler(panel);
};
