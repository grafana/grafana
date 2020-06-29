import { PanelModel, FieldConfigSource, DataLink } from '@grafana/data';

/**
 * Called when upgrading from a previously saved versoin
 */
export const graphPanelMigrationHandler = (panel: PanelModel<any>): Partial<any> => {
  const fieldOptions: FieldConfigSource = {
    defaults: {},
    overrides: [],
  };

  const options = panel.options || {};

  // Move <7.1 dataLinks to the field section
  if (options.dataLinks) {
    fieldOptions.defaults.links = options.dataLinks as DataLink[];
    delete options.dataLinks;
  }

  // const fieldConfig = fieldOptions.defaults;
  // fieldConfig.

  console.log('GRAPH migration', panel);

  // HACK: Mutates the panel state directly
  panel.fieldConfig = fieldOptions;
  return options;
};

// This is called when the panel changes from another panel
export const graphPanelChangedHandler = (panel: PanelModel<any> | any, prevPluginId: string, prevOptions: any) => {
  console.log('GRAPH changed', panel, prevPluginId, prevOptions);
  return {};
};
