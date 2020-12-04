import { PanelModel } from '@grafana/data';
import { Options } from './types';

/**
 * Introduced in grafana 7.4
 */
export const graphMigrationHandler = (panel: PanelModel<Options>): Partial<Options> => {
  // Nothing to change (but the version will be saved)
  return panel.options;
};

/**
 * This is called when the panel changes from another panel
 */
export const graphPanelChangedHandler = (
  panel: PanelModel<Partial<Options>> | any,
  prevPluginId: string,
  prevOptions: any
) => {
  // Changing from float table panel
  if (prevPluginId === 'graph' && prevOptions.angular) {
    console.log('Change from graph', prevOptions);
  }

  return {};
};
