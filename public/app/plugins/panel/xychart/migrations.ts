import { FieldMatcherID, FrameMatcherID, PanelModel } from '@grafana/data';

import { Options } from './panelcfg.gen';
import { SeriesMapping2 } from './types2';

export const xyChartMigrationHandler = (panel: PanelModel): Partial<Options> => {
  const pluginVersion = panel?.pluginVersion ?? '';

  // Update to new format for GA 10.4 release
  // Initial plugin version is empty string for first migration
  if (pluginVersion === '') {
    console.log('Migration: xyChartMigrationHandler', { ...panel.options });
    for (const series of panel.options.series) {
      // Update x / y to new format using field matchers when in manual mode
      const xField = series.x;
      const yField = series.y;
      const excludeYFields = series?.dims?.exclude;
      const seriesSizeField = series?.size?.field;
      const seriesColorField = series?.color?.field;

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
          ...(excludeYFields && {
            exclude: {
              id: FieldMatcherID.byNames,
              options: excludeYFields,
            },
          }),
        },
      };

      if (series.size) {
        series.size = {
          ...(seriesSizeField && {
            field: {
              matcher: {
                id: FieldMatcherID.byName,
                options: seriesSizeField,
              },
            },
          }),
        };
      }

      if (series.color) {
        series.color = {
          ...(seriesColorField && {
            field: {
              matcher: {
                id: FieldMatcherID.byName,
                options: seriesColorField,
              },
            },
          }),
        };
      }

      // Frame is required for manual mode
      if (panel.options.seriesMapping === SeriesMapping2.Manual) {
        series.frame = {
          id: FrameMatcherID.byIndex,
          options: 0,
        };
      }
    }

    // Handle mapping option cleanup
    panel.options.mapping = `${panel.options.seriesMapping}`;
    delete panel.options.seriesMapping;
  }

  // TODO: Add migration tests
  console.log('Migration: xyChartMigrationHandler RESULT', panel.options);

  return panel.options;
};
