import { PanelModel } from '@grafana/data';

import { Options, defaultOptions } from './panelcfg.gen';

/**
 * Called when converting from another panel type to this panel.
 * Returns the initial options for the new panel.
 */
export const instantQueryResultsPanelChangedHandler = (
  _panel: PanelModel<Partial<Options>>,
  _prevPluginId: string,
  _prevOptions: unknown
): Partial<Options> => {
  // New panel - use defaults
  return { ...defaultOptions };
};

/**
 * Migration handler for panel options schema changes.
 * Currently no migrations needed for this new panel.
 */
export const instantQueryResultsMigrationHandler = (panel: PanelModel<Options>): Partial<Options> => {
  return panel.options;
};
