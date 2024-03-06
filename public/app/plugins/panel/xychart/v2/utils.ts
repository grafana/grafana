import {
  Field,
  formattedValueToString,
  getFieldMatcher,
  FieldType,
  getFieldDisplayName,
  DataFrame,
  FrameMatcherID,
  MatcherConfig,
  FieldColorModeId,
  cacheFieldDisplayNames,
  FieldMatcherID,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { VisibilityMode } from '@grafana/schema';

import { ScatterShow, SeriesMapping } from '../panelcfg.gen';
import { XYSeries, XYSeriesConfig } from '../types2';

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

export function prepSeries(mapping: SeriesMapping, mappedSeries: XYSeriesConfig[], frames: DataFrame[]) {
  cacheFieldDisplayNames(frames);

  let series: XYSeries[] = [];

  const { palette, getColorByName } = config.theme2.visualization;

  mappedSeries.forEach((seriesCfg) => {
    let xMatcher = getFieldMatcher(
      seriesCfg.x?.matcher ?? {
        id: FieldMatcherID.byType,
        options: 'number',
      }
    );
    let yMatcher = getFieldMatcher(
      seriesCfg.y?.matcher ?? {
        id: FieldMatcherID.byType,
        options: 'number',
      }
    );
    let yExclude = seriesCfg.y?.exclude ? getFieldMatcher(seriesCfg.y.exclude) : null;
    let colorMatcher = seriesCfg.color ? getFieldMatcher(seriesCfg.color.matcher) : null;
    let sizeMatcher = seriesCfg.size ? getFieldMatcher(seriesCfg.size.matcher) : null;
    // let frameMatcher = seriesCfg.frame ? getFrameMatchers(seriesCfg.frame) : null;
    let frameMatcher = seriesCfg.frame ? getFrameMatcher2(seriesCfg.frame.matcher) : null;

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
          if (mapping === SeriesMapping.Manual && frameSeries.length > 0) {
            return;
          }

          // if we match non-excluded y, create series
          if (yMatcher(field, frame, frames) && (yExclude == null || !yExclude(field, frame, frames))) {
            let y = field;
            let name = getFieldDisplayName(y, frame, frames); // `Series ${seriesIdx + 1}`

            let ser: XYSeries = {
              // these typically come from y field
              name,

              showPoints: y.config.custom.show === ScatterShow.Lines ? VisibilityMode.Never : VisibilityMode.Always,

              showLine: y.config.custom.show !== ScatterShow.Points,
              lineWidth: y.config.custom.lineWidth ?? 2,
              lineStyle: y.config.custom.lineStyle,
              // lineColor: () => seriesColor,
              x: {
                field: x!,
              },
              y: {
                field: y,
              },
              color: {},
              size: {},
            };

            if (color != null) {
              ser.color.field = color;
            }

            if (size != null) {
              ser.size.field = size;
              ser.size.min = size.config.custom.pointSizeMin ?? 5;
              ser.size.max = size.config.custom.pointSizeMax ?? 100;
              // ser.size.mode =
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

    let paletteIdx = 0;

    // todo: populate min, max, mode from field + hints
    series.forEach((s, i) => {
      if (s.color.field == null) {
        // derive fixed color from y field config
        let colorCfg = s.y.field.config.color!;

        let value = '';

        if (colorCfg.mode === FieldColorModeId.PaletteClassic) {
          value = getColorByName(palette[paletteIdx++ % palette.length]); // todo: do this via state.seriesIdx and re-init displayProcessor
        } else if (colorCfg.mode === FieldColorModeId.Fixed) {
          value = getColorByName(colorCfg.fixedColor!);
        }

        s.color.fixed = value;
      }

      if (s.size.field == null) {
        // derive fixed size from y field config
        s.size.fixed = s.y.field.config.custom.pointSize.fixed ?? 5;
        // ser.size.mode =
      }
    });

    // strip common prefix from names
    let parts = series[0].name.split(' ');

    if (parts.length > 1 && series.every((s) => s.name.startsWith(parts[0]))) {
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
