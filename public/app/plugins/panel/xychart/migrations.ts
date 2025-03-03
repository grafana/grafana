import { FieldMatcherID, FrameMatcherID, MatcherConfig, PanelModel } from '@grafana/data';

import { XYSeriesConfig, Options } from './panelcfg.gen';
import { ScatterSeriesConfig, SeriesMapping, XYDimensionConfig, Options as PrevOptions } from './panelcfgold.gen';

export const xyChartMigrationHandler = (panel: PanelModel): Options => {
  const pluginVersion = panel?.pluginVersion ?? '';

  if (pluginVersion === '' || parseFloat(pluginVersion) < 11.1) {
    return migrateOptions(panel);
  }

  return panel.options;
};

function migrateOptions(panel: PanelModel): Options {
  const { dims, seriesMapping, series: oldSeries, ...cleanedOpts } = panel.options as PrevOptions;
  const { exclude = [], frame: frameShared, x: xShared }: XYDimensionConfig = dims ?? {};

  const custDefaults = panel.fieldConfig.defaults.custom;

  let oldSeries2 = oldSeries;

  if (seriesMapping === SeriesMapping.Auto) {
    oldSeries2 = [
      {
        x: undefined,
        y: undefined,
      },
    ];
  }

  /*
  // old manual mode example
  "series": [
    {
      "pointColor": {
        "fixed": "purple"       // this becomes override for y field.config.custom.pointColor.fixed, (or config.color?)
        "field": "BMI Male",    // ...unless another field is mapped, then ignore
      },
      "pointSize": {
        "field": "Weight Male",
        "max": 40,              // this becomes override for y field.config.custom.pointSize.max
        "min": 1,               // ...and .min
        "fixed": 50.5
      },
      "frame": 0,               // byIndex frame matcher
      "x": "Height Male",       // byName field matcher, falls back to byType/number field matcher
      "y": "Weight Male"        // byName field matcher, falls back to byType/number field matcher
    }
  ],
*/
  let i = 0;

  const newSeries: XYSeriesConfig[] = oldSeries2.map(({ x, y, pointColor, pointSize, frame }: ScatterSeriesConfig) => {
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

    if (colorField == null && colorFixed && custDefaults.pointColor?.fixed !== colorFixed) {
      // NOTE: intentionally not using custom.pointColor.fixed
      let hasOverride = panel.fieldConfig.overrides.some(
        (o) =>
          o.matcher.id === yMatcherConfig.id &&
          o.matcher.options === yMatcherConfig.options &&
          o.properties.some((p) => p.id === 'color')
      );

      if (!hasOverride) {
        panel.fieldConfig.overrides.push({
          matcher: yMatcherConfig,
          properties: [
            {
              id: 'color',
              value: {
                mode: 'fixed',
                fixedColor: colorFixed,
              },
            },
          ],
        });
      }
    }

    // add field overrides for custom pointSize.fixed
    if (sizeField == null && sizeFixed && custDefaults.pointSize?.fixed !== sizeFixed) {
      let hasOverride = panel.fieldConfig.overrides.some(
        (o) =>
          o.matcher.id === yMatcherConfig.id &&
          o.matcher.options === yMatcherConfig.options &&
          o.properties.some((p) => p.id === 'custom.pointSize.fixed')
      );

      if (!hasOverride) {
        panel.fieldConfig.overrides.push({
          matcher: yMatcherConfig,
          properties: [
            {
              id: 'custom.pointSize.fixed',
              value: sizeFixed,
            },
          ],
        });
      }
    }

    if (sizeField != null) {
      // add field overrides for custom pointSize.min
      if (sizeMin && custDefaults.pointSize?.min !== sizeMin) {
        let hasOverride = panel.fieldConfig.overrides.some(
          (o) =>
            o.matcher.id === yMatcherConfig.id &&
            o.matcher.options === yMatcherConfig.options &&
            o.properties.some((p) => p.id === 'custom.pointSize.min')
        );

        if (!hasOverride) {
          panel.fieldConfig.overrides.push({
            matcher: {
              id: FieldMatcherID.byName,
              options: sizeField,
            },
            properties: [
              {
                id: 'custom.pointSize.min',
                value: sizeMin,
              },
            ],
          });
        }
      }
      // add field overrides for custom pointSize.min
      if (sizeMax && custDefaults.pointSize?.max !== sizeMax) {
        let hasOverride = panel.fieldConfig.overrides.some(
          (o) =>
            o.matcher.id === yMatcherConfig.id &&
            o.matcher.options === yMatcherConfig.options &&
            o.properties.some((p) => p.id === 'custom.pointSize.max')
        );

        if (!hasOverride) {
          panel.fieldConfig.overrides.push({
            matcher: {
              id: FieldMatcherID.byName,
              options: sizeField,
            },
            properties: [
              {
                id: 'custom.pointSize.max',
                value: sizeMax,
              },
            ],
          });
        }
      }
    }

    return {
      frame: {
        matcher: {
          id: FrameMatcherID.byIndex,
          options: frame ?? (seriesMapping === SeriesMapping.Manual ? i++ : (frameShared ?? 0)),
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

  const newOptions: Options = {
    ...cleanedOpts,
    mapping: seriesMapping === SeriesMapping.Auto ? SeriesMapping.Auto : SeriesMapping.Manual,
    series: newSeries,
  };

  return newOptions;
}
