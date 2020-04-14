import { PanelModel } from '@grafana/data';
import { Options } from './types';
import { ChangePanelTypeError } from 'app/features/dashboard/state/ChangePanelTypeError';

// This is called when the panel first loads with the version
export const tableMigrationHandler = (panel: PanelModel<Options>): Partial<Options> => {
  // Table was saved as an angular table, lets just swap to the 'table-old' panel
  if (!panel.pluginVersion && (panel as any).columns) {
    throw new ChangePanelTypeError('table-old');
  }

  // Nothing changed
  return panel.options;
};

// This is called when the panel changes from another panel
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
