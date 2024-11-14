import { PanelModel, FieldConfigSource, DataLink } from '@grafana/data';

/**
 * Called when upgrading from a previously saved versoin
 */
export const graphPanelMigrationHandler = (panel: PanelModel<any>): Partial<any> => {
  const fieldConfig: FieldConfigSource = panel.fieldConfig ?? {
    defaults: {},
    overrides: [],
  };

  const options = panel.options || {};

  // Move <7.1 dataLinks to the field section
  if (options.dataLinks) {
    fieldConfig.defaults.links = options.dataLinks as DataLink[];
    delete options.dataLinks;
  }

  // Mutate the original panel state (only necessary because it is angular)
  panel.options = options;
  panel.fieldConfig = fieldConfig;
  return options;
};
