import {
  Field,
  formattedValueToString,
  getFieldMatcher,
  FieldType,
  getFieldDisplayName,
  DataFrame,
  FrameMatcherID,
  MatcherConfig,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import { PanelOpts, SeriesMapping2, XYSeries } from './types2';

export function fmt(field: Field, val: number): string {
  if (field.display) {
    return formattedValueToString(field.display(val));
  }

  return `${val}`;
}

// cause we dont have a proper matcher for this currently
function getFrameMatcher2(config: MatcherConfig) {
  if (config.id === FrameMatcherID.byIndex) {
    return (frame: DataFrame, index: number) => index === config.options;
  }

  return () => false;
}

export function prepXYSeries(panelOpts: PanelOpts, frames: DataFrame[]) {
  let series: XYSeries[] = [];

  const { palette, getColorByName } = config.theme2.visualization;

  panelOpts.series.forEach((seriesCfg) => {
    let xMatcher = getFieldMatcher(seriesCfg.x.field.matcher);
    let yMatcher = getFieldMatcher(seriesCfg.y.field.matcher);
    let yExclude = seriesCfg.y.field.exclude ? getFieldMatcher(seriesCfg.y.field.exclude) : null;
    let colorMatcher = seriesCfg.color?.field ? getFieldMatcher(seriesCfg.color.field.matcher) : null;
    let sizeMatcher = seriesCfg.size?.field ? getFieldMatcher(seriesCfg.size.field.matcher) : null;
    // let frameMatcher = seriesCfg.frame ? getFrameMatchers(seriesCfg.frame) : null;
    let frameMatcher = seriesCfg.frame ? getFrameMatcher2(seriesCfg.frame) : null;

    // loop over all frames and fields, adding a new series for each y dim
    frames.forEach((frame, frameIdx) => {
      // must match frame in manual mode
      if (frameMatcher != null && !frameMatcher(frame, frameIdx)) {
        return;
      }

      let frameSeries: XYSeries[] = [];

      // only grabbing number fields (exclude time, string, enum, other)
      let onlyNumFields = frame.fields.filter((field) => field.type === FieldType.number);

      // only one of these per frame
      let x = onlyNumFields.find((field) => xMatcher(field, frame, frames));
      let color =
        colorMatcher != null
          ? onlyNumFields.find((field) => field !== x && colorMatcher!(field, frame, frames))
          : undefined;
      let size =
        sizeMatcher != null
          ? onlyNumFields.find((field) => field !== x && field !== color && sizeMatcher!(field, frame, frames))
          : undefined;

      // x field is required
      if (x != null) {
        // match y fields and create series
        onlyNumFields.forEach((field) => {
          // don't reuse already-mapped fields
          if (field === x || field === color || field === size) {
            return;
          }

          // in manual mode only add single series for this frame
          if (panelOpts.mapping === SeriesMapping2.Manual && frameSeries.length > 0) {
            return;
          }

          // if we match non-excluded y, create series
          if (yMatcher(field, frame, frames) && (yExclude == null || !yExclude(field, frame, frames))) {
            let y = field;
            let name = seriesCfg.name ?? getFieldDisplayName(y, frame, frames); // `Series ${seriesIdx + 1}`

            let ser: XYSeries = {
              name,
              x: {
                field: {
                  value: x!,
                },
              },
              y: {
                field: {
                  value: y,
                },
              },
              color: {
                fixed: {
                  value: seriesCfg.color?.fixed?.value ?? '', // default will be set after all series are added (below)
                },
              },
              size: {
                fixed: {
                  value: seriesCfg.size?.fixed?.value ?? 5, // default fixed size
                },
              },
            };

            if (color != null) {
              ser.color.field = { value: color };
            }

            if (size != null) {
              ser.size.field = {
                value: size,
                min: seriesCfg.size?.field?.min ?? 5, // default min
                max: seriesCfg.size?.field?.max ?? 100, // default max
              }; // default range
            }

            frameSeries.push(ser);
          }
        });

        if (frameSeries.length === 0) {
          // TODO: could not create series, skip & show error?
        }

        series.push(...frameSeries);
      } else {
        // x is missing in this frame!
      }
    });
  });

  if (series.length === 0) {
    // TODO: could not create series, skip & show error?
  } else {
    // assign classic palette colors by index, as fallbacks for all series
    series.forEach((s, i) => {
      s.color.fixed.value = getColorByName(palette[i % palette.length]);
    });

    // strip common prefix from names
    let parts = series[0].name.split(' ');

    if (parts.length > 1 && series.every(s => s.name.startsWith(parts[0]))) {
      series.forEach((s, i) => {
        s.name = s.name.slice(parts[0].length);
      });
    }
  }

  // TODO: regenerate display names?
  // y.state = {
  //   ...y.state,
  //   seriesIndex: series.length + ,
  // };
  // y.display = getDisplayProcessor({ field, theme });

  return series;
}
