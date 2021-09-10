import { DataFrame, DataFrameFieldIndex, FieldLookup, FieldMap, FieldType, getFieldDisplayName } from '@grafana/data';
import {
  getColorDimension,
  getScaledDimension,
  findField,
  getTextDimension,
  ColorDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
} from 'app/features/dimensions';
import { ScatterSeries, XYChartOptions } from './types';
import { config } from '@grafana/runtime';
import { ScaleDirection, ScaleOrientation, UPlotConfigBuilder, UPlotConfigPrepFnXY } from '@grafana/ui';

export function prepDims(options: XYChartOptions, frames: DataFrame[]): ScatterSeries[] {
  if (!frames.length) {
    return [];
  }

  const cfg = options.series ?? {};

  // field indices found in first frame
  let xIdx = -1;
  let yIdx = -1;
  let colorIdx = -1;
  let sizeIdx = -1;
  let labelIdx = -1;

  return frames.map((frame, i) => {
    // map first frame by field names
    if (i === 0) {
      const series: ScatterSeries = {
        x: findField(frame, cfg.x),
        y: findField(frame, cfg.y),

        color: getColorDimension(frame, cfg.color ?? { fixed: '#F00' }, config.theme2),
        size: getScaledDimension(frame, cfg.size ?? { fixed: 5, min: 1, max: 5 }),
        label: cfg.label ? getTextDimension(frame, cfg.label) : undefined,

        name: 'hello',
        frame,
      };

      xIdx = frame.fields.findIndex((field) => field === series.x);
      yIdx = frame.fields.findIndex((field) => field === series.y);
      colorIdx = series.color.field ? frame.fields.findIndex((field) => field === series.color.field) : -1;
      sizeIdx = series.size?.field ? frame.fields.findIndex((field) => field === series.size?.field) : -1;
      labelIdx = series.label?.field ? frame.fields.findIndex((field) => field === series.label?.field) : -1;

      return series;
    }
    // map remaining frames by indicies of fields found in first frame
    else {
      let colorCfg: ColorDimensionConfig =
        colorIdx > -1 ? { ...cfg.color, field: getFieldDisplayName(frame.fields[colorIdx], frame) } : cfg.color;

      let sizeCfg: ScaleDimensionConfig =
        sizeIdx > -1 ? { ...cfg.size, field: getFieldDisplayName(frame.fields[sizeIdx], frame) } : cfg.size;

      let labelCfg: TextDimensionConfig =
        labelIdx > -1 ? { ...cfg.label, field: getFieldDisplayName(frame.fields[labelIdx], frame) } : cfg.label;

      const series: ScatterSeries = {
        x: frame.fields[xIdx],
        y: frame.fields[yIdx],

        color: getColorDimension(frame, colorCfg, config.theme2),
        size: getScaledDimension(frame, sizeCfg),
        label: labelCfg ? getTextDimension(frame, labelCfg) : undefined,

        name: 'hello',
        frame,
      };

      return series;
    }
  });
}

type PrepFieldLookup = (dims: ScatterSeries[], frames: DataFrame[]) => FieldLookup;

export const prepLookup: PrepFieldLookup = (dims, frames) => {
  const byIndex = new Map<number, DataFrameFieldIndex>();
  const byName = new Map<string, DataFrameFieldIndex>();

  let seriesIndex = 0;

  const fieldMaps = frames.map((frame, frameIndex) => {
    let fieldMap: FieldMap = {
      x: frame.fields.findIndex((field) => field === dims[frameIndex].x),
      y: frame.fields.findIndex((field, fieldIndex) => {
        if (field === dims[frameIndex].y) {
          const displayName = getFieldDisplayName(field, frame, frames);
          const fieldOrigin = { frameIndex, fieldIndex, seriesIndex, displayName };

          byIndex.set(seriesIndex, fieldOrigin);
          byName.set(displayName, fieldOrigin);

          seriesIndex++;
          return true;
        }
        return false;
      }),
    };

    fieldMap.legend = [fieldMap.y as number];
    fieldMap.tooltip = [fieldMap.y as number];
    fieldMap.count = 1;

    return fieldMap;
  });

  return {
    fieldMaps,
    byIndex,
    byName,
    enumerate(frames) {
      byIndex.forEach(({ frameIndex, fieldIndex, seriesIndex }) => {
        let field = frames[frameIndex].fields[fieldIndex];
        let state = field.state ?? {};
        state.seriesIndex = seriesIndex;
        field.state = state;
      });
    },
  };
};

export const prepConfig: UPlotConfigPrepFnXY<XYChartOptions> = ({
  mode,
  frames,
  lookup,
  theme,
  eventBus,
  ...options
}) => {
  const builder = new UPlotConfigBuilder();

  builder.addScale({
    scaleKey: 'x',
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    range: [0, 100],
  });

  builder.addScale({
    scaleKey: 'y',
    orientation: ScaleOrientation.Vertical,
    direction: ScaleDirection.Up,
    range: [0, 100],
  });

  builder.addAxis({
    scaleKey: 'x',
    theme,
  });

  builder.addAxis({
    scaleKey: 'y',
    theme,
  });

  builder.setPrepData((frames) => {
    lookup.enumerate(frames);

    let seriesData = lookup.fieldMaps.map((f, i) => {
      let { fields } = frames[i];

      return [fields[f.x], fields[f.y as number]];
    });

    return [null, ...seriesData];
  });

  return builder;
};
