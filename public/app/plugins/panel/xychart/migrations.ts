import { FieldMatcherID, FrameMatcherID, PanelModel } from '@grafana/data';

import { Options } from './panelcfg.gen';

export const xyChartMigrationHandler = (panel: PanelModel): Partial<Options> => {
  // Renamed `seriesMapping` to `mapping` in GA 10.4 release
  const shouldMigrate = panel.options.seriesMapping != null;

  // Update to new format for GA 10.4 release
  if (shouldMigrate) {
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
          exclude: excludeYFields
            ? {
                id: FieldMatcherID.byNames,
                options: excludeYFields,
              }
            : undefined,
        },
      };

      // TODO: figure out why this is breaking things
      //   if (series.size) {
      //     series.size = {
      //       field: {
      //         matcher: {
      //           id: FieldMatcherID.byName,
      //           options: seriesSizeField,
      //         },
      //       },
      //     };
      //   }

      //   if (series.color) {
      //     series.color = {
      //       field: {
      //         matcher: {
      //           id: FieldMatcherID.byName,
      //           options: seriesColorField,
      //         },
      //       },
      //     };
      //   }

      // Required for manual mode
      // TODO: update with enum type instead of string
      if (panel.options.seriesMapping === 'manual') {
        series.frame = {
          id: FrameMatcherID.byIndex,
          options: 0,
        };
      }
    }

    // Handle mapping option cleanup
    panel.options.mapping = panel.options.seriesMapping;
    delete panel.options.seriesMapping;
  }

  console.log('Migration: xyChartMigrationHandler', panel.options);

  return panel.options;
};
