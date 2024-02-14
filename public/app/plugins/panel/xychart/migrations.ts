import { FieldMatcherID, FrameMatcherID, MatcherConfig, PanelModel } from '@grafana/data';

import { Options, SeriesMapping } from './panelcfg.gen';
import { XYSeriesConfig, Options as Options2, SeriesMapping2 } from './types2';

export const xyChartMigrationHandler = (panel: PanelModel<Options>): Options | Options2 => {
  const pluginVersion = panel?.pluginVersion ?? '';

  // Update to new format for GA 10.4 release
  // Initial plugin version is empty string for first migration
  if (pluginVersion === '') {
    const { dims, seriesMapping, series: oldSeries, ...cleanedOpts } = panel.options;
    const { exclude, frame, x: xShared } = dims ?? {};

    let oldSeries2 = oldSeries;

    if (seriesMapping === SeriesMapping.Auto) {
      oldSeries2 = [
        {
          x: undefined,
          y: undefined,
        },
      ];
    }

    const newSeries: XYSeriesConfig[] = oldSeries2.map(({ x, y, pointColor, pointSize }) => {
      const { fixed: colorFixed, field: colorField } = pointColor ?? {};
      const { fixed: sizeFixed, field: sizeField, min: sizeMin, max: sizeMax } = pointSize ?? {};

      let xMatcherConfig: MatcherConfig;
      let yMatcherConfig: MatcherConfig;

      // old auto mode did not require x field defined
      if (x == null && xShared == null) {
        xMatcherConfig = {
          id: FieldMatcherID.byType,
          options: 'number',
        };
      } else {
        xMatcherConfig = {
          id: FieldMatcherID.byName,
          options: x ?? xShared,
        };
      }

      if (y == null) {
        yMatcherConfig = {
          id: FieldMatcherID.byType,
          options: 'number',
        };
      } else {
        yMatcherConfig = {
          id: FieldMatcherID.byName,
          options: y,
        };
      }

      return {
        frame: {
          id: FrameMatcherID.byIndex,
          options: seriesMapping === SeriesMapping.Manual ? 0 : frame ?? 0,
        },
        x: {
          field: {
            matcher: xMatcherConfig,
          },
        },
        y: {
          field: {
            matcher: yMatcherConfig,
            ...(exclude &&
              exclude.length && {
                exclude: {
                  id: FieldMatcherID.byNames,
                  options: exclude,
                },
              }),
          },
        },
        ...((colorFixed || colorField) && {
          color: {
            ...(colorFixed && {
              fixed: {
                value: colorFixed,
              },
            }),
            ...(colorField && {
              field: {
                matcher: {
                  id: FieldMatcherID.byName,
                  options: colorField,
                },
              },
            }),
          },
        }),
        ...((sizeFixed || sizeField) && {
          size: {
            ...(sizeFixed && {
              fixed: {
                value: sizeFixed,
              },
            }),
            ...(sizeField && {
              field: {
                matcher: {
                  id: FieldMatcherID.byName,
                  options: sizeField,
                },
                min: sizeMin,
                max: sizeMax,
              },
            }),
          },
        }),
      };
    });

    const newOptions: Options2 = {
      ...cleanedOpts,
      mapping: seriesMapping === SeriesMapping.Auto ? SeriesMapping2.Auto : SeriesMapping2.Manual,
      series: newSeries,
    };

    // console.log('xyChartMigrationHandler', panel.options, newOptions);

    return newOptions;
  }

  return panel.options;
};
