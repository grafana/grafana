import { FieldMatcherID, PanelModel } from '@grafana/data';

import { Options } from './panelcfg.gen';

export const xyChartMigrationHandler = (panel: PanelModel): Partial<Options> => {
  const pluginVersion = panel?.pluginVersion ?? '';

  // Update to new format for GA
  // Initial plugin version is empty string for first migration
  if (pluginVersion === '') {
    console.log('Migration: xyChartMigrationHandler', panel);

    for (const series of panel.options.series) {
      // Update x / y to new format using field matchers when in manual mode
      if (panel.options.seriesMapping === 'manual') {
        const xField = series.x;
        const yField = series.y;

        series.x = {
          field: {
            matcher: {
              id: FieldMatcherID.byName,
              options: xField,
            },
          },
        };

        series.y = {
          field: {
            matcher: {
              id: FieldMatcherID.byName,
              options: yField,
            },
          },
        };
      }
    }

    // Add case for color / size

    // TODO: case for auto mode (table / dynamic rolled into one)
  }

  return panel.options;
};
