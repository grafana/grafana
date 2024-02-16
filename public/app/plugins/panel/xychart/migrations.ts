import { FieldMatcherID, FrameMatcherID, MatcherConfig, PanelModel } from '@grafana/data';

import { ScatterSeriesConfig, SeriesMapping } from './panelcfg.gen';
import { XYSeriesConfig, Options2 as Options2 } from './types2';

export const xyChartMigrationHandler = (panel: PanelModel): Options2 => {
  const pluginVersion = panel?.pluginVersion ?? '';

  // Update to new format for GA 10.4 release
  // Initial plugin version is empty string for first migration
  if (pluginVersion === '') {
    const { dims, seriesMapping, series: oldSeries, ...cleanedOpts } = panel.options;
    const { exclude = [], frame, x: xShared } = dims ?? {};

    let oldSeries2 = oldSeries;

    if (seriesMapping === SeriesMapping.Auto) {
      oldSeries2 = [
        {
          x: undefined,
          y: undefined,
        },
      ];
    }

    const newSeries: XYSeriesConfig[] = oldSeries2.map(({ x, y, pointColor, pointSize }: ScatterSeriesConfig) => {
      const { fixed: colorFixed, field: colorField } = pointColor ?? {};
      const { fixed: sizeFixed, field: sizeField, min: sizeMin, max: sizeMax } = pointSize ?? {};

      let xMatcherConfig: MatcherConfig;
      let yMatcherConfig: MatcherConfig;

      // old auto mode did not require x field defined
      if (x == null && xShared == null) {
        // TODO: this should just be the internal default. no need to store on save model
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
        // TODO: this should just be the internal default. no need to store on save model
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

      if (colorField == null && colorFixed) {
        // if same as defaults, skip
        if (panel.fieldConfig.defaults.custom.pointColor === colorFixed) {
        }

        let hasOverride = panel.fieldConfig.overrides.some(
          (o) =>
            o.matcher.id === yMatcherConfig.id &&
            o.matcher.options === yMatcherConfig.options &&
            o.properties.some((p) => p.id === 'custom.pointColor')
        );

        if (!hasOverride) {
          panel.fieldConfig.overrides.push({
            matcher: yMatcherConfig,
            properties: [
              {
                id: 'custom.pointColor',
                value: colorFixed,
              },
            ],
          });
        }
      }

      // add field overrides for custom size
      if (sizeField == null && sizeFixed) {
        // if same as defaults, skip
        if (panel.fieldConfig.defaults.custom.pointSize === sizeFixed) {
        }

        let hasOverride = panel.fieldConfig.overrides.some(
          (o) =>
            o.matcher.id === yMatcherConfig.id &&
            o.matcher.options === yMatcherConfig.options &&
            o.properties.some((p) => p.id === 'custom.pointSize')
        );

        // if override already exists, ignore
        if (!hasOverride) {
          panel.fieldConfig.overrides.push({
            matcher: yMatcherConfig,
            properties: [
              {
                id: 'custom.pointSize',
                value: sizeFixed,
              },
            ],
          });
        }
      }

      return {
        frame: {
          matcher: {
            id: FrameMatcherID.byIndex,
            options: seriesMapping === SeriesMapping.Manual ? 0 : frame ?? 0,
          },
        },
        x: {
          matcher: xMatcherConfig,
        },
        y: {
          matcher: yMatcherConfig,
          ...(exclude.length && {
            exclude: {
              id: FieldMatcherID.byNames,
              options: exclude,
            },
          }),
        },
        ...(colorField && {
          color: {
            matcher: {
              id: FieldMatcherID.byName,
              options: colorField,
            },
          },
        }),
        ...(sizeField && {
          size: {
            matcher: {
              id: FieldMatcherID.byName,
              options: sizeField,
            },
          },
        }),
      };
    });

    const newOptions: Options2 = {
      ...cleanedOpts,
      mapping: seriesMapping === SeriesMapping.Auto ? SeriesMapping.Auto : SeriesMapping.Manual,
      series: newSeries,
    };

    // panel.fieldConfig = {
    //   defaults,
    //   overrides,
    // };

    // console.log('xyChartMigrationHandler', panel.options, newOptions);

    return newOptions;
  }

  return panel.options;
};
