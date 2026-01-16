import { PanelModel } from '@grafana/data';

import { Options } from './panelcfg.gen';

/**
 * Migration handler for panel options schema changes.
 * Currently no migrations needed for this new panel.
 */
export const rawPrometheusMigrationHandler = (panel: PanelModel<Options>): Partial<Options> => {
  return panel.options;
};
