import { PanelModel } from '@grafana/data';

import { Options } from './panelcfg.gen';

export const xyChartMigrationHandler = (panel: PanelModel): Partial<Options> => {
  const pluginVersion = panel?.pluginVersion ?? '';

  // Update to new format for GA
  // Initial plugin version is empty string for first migration
  if (pluginVersion === '') {
    console.log('Migration: xyChartMigrationHandler', panel);
  }

  return panel.options;
};
