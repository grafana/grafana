import { sharedSingleStatPanelChangedHandler, sharedSingleStatMigrationHandler } from '@grafana/ui';
import { PanelModel } from '@grafana/data';
import { GaugeOptions } from './types';

/**
 * Called when upgrading from a previously saved versoin
 */
export const graphPanelMigrationHandler = (panel: PanelModel<any>): Partial<any> => {
  const fieldConfig: FieldConfig = {
    defaults: {},
    overrides: [],
  };

  console.log('GRAPH migration', panel);

  const y0 = panel.yaxes[0];
  if (y0) {
    if (y0.format !== undefined) {
      fieldConfig.unit = y0.format;
    }
    if (y0.decimals !== undefined) {
      fieldConfig.decimals = y0.decimals;
    }
  }

  const y1 = panel.yaxes[0];

  // HACK: Mutates the panel state directly
  panel.fieldConfig;
  return panel.options;
};

// This is called when the panel changes from another panel
export const graphPanelChangedHandler = (panel: PanelModel<any> | any, prevPluginId: string, prevOptions: any) => {
  console.log('GRAPH changed', panel, prevPluginId, prevOptions);
  return {};
};
