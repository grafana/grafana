import { PanelModel } from '@grafana/data';
import { Options } from './types';
import { ChangePanelTypeError } from 'app/features/dashboard/state/ChangePanelTypeError';

/**
 * At 7.0, the `table` panel was swapped from an angular implementation to a react one.
 * The models do not match, so this process will delegate to the old implementation when
 * a saved table configuration exists.
 */
export const tableMigrationHandler = (panel: PanelModel<Options>): Partial<Options> => {
  // Table was saved as an angular table, lets just swap to the 'table-old' panel
  if (!panel.pluginVersion && (panel as any).columns) {
    // TODO: depending on the configuration, we be able to automatically migrate
    throw new ChangePanelTypeError('table-old');
  }

  // Nothing changed
  return panel.options;
};

/**
 * This is called when the panel changes from another panel
 */
export const tablePanelChangedHandler = (
  panel: PanelModel<Partial<Options>> | any,
  prevPluginId: string,
  prevOptions: any
) => {
  // Changing from angular singlestat
  if (prevPluginId === 'table-old' && prevOptions.angular) {
    console.log('Migrating from angular table', panel);
  }
  return prevOptions;
};
