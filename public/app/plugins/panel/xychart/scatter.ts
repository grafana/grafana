import { DataFrame, Field, getFieldDisplayName, PanelData, TimeZone } from '@grafana/data';
import { LineStyle, VisibilityMode } from '@grafana/schema';
import { DimensionValues, UPlotConfigBuilder, VizLegendItem } from '@grafana/ui';
import { FacetedData } from '@grafana/ui/src/components/uPlot/types';
import {
  ColorDimensionConfig,
  findFieldIndex,
  getColorDimensionForField,
  getScaledDimensionForField,
  getTextDimensionForField,
  ScaleDimensionConfig,
  TextDimensionConfig,
} from 'app/features/dimensions';
import { config } from '@grafana/runtime';
import { defaultScatterConfig, ScatterFieldConfig, ScatterLineMode, XYChartOptions } from './models.gen';

// Using field where we will need formatting/scale/axis info
// Use raw or DimensionValues when the values can be used directly
export interface ScatterSeries {
  name: string;

  /** Finds the relevant frame from the raw panel data */
  frame: (raw: DataFrame[]) => DataFrame;

  x: (frame: DataFrame) => Field;
  y: (frame: DataFrame) => Field;
  legend: (frame: DataFrame) => VizLegendItem[]; // could be single if symbol is constant

  line: ScatterLineMode;
  lineWidth: number;
  lineStyle: LineStyle;
  lineColor: DimensionValues<CanvasRenderingContext2D['strokeStyle']>;

  point: VisibilityMode;
  pointSize: DimensionValues<number>;
  pointColor: DimensionValues<CanvasRenderingContext2D['strokeStyle']>;
  pointSymbol: DimensionValues<string>; // single field, multiple symbols.... kinda equals multiple series 🤔

  label: VisibilityMode;
  labelValue: DimensionValues<string>;
}

export interface ScatterPanelInfo {
  error?: string;
  series: ScatterSeries[];
  builder: UPlotConfigBuilder;

  // Called whenever the data changes
  //  prepare: (data: PanelData) => FacetedData | AlignedData;
}

/**
 * This is called when options or structure rev changes
 */
export function prepareScatterPlot(options: XYChartOptions, data: PanelData, tz: TimeZone): ScatterPanelInfo {
  if (!data.series?.length) {
    return {
      error: 'missing data',
    } as ScatterPanelInfo;
  }
  const builder = new UPlotConfigBuilder(tz);
  const series: ScatterSeries[] = [];
  if (options.mode === 'single') {
    const { single } = options;
    if (!single?.x) {
      return {
        error: `Select X dimension`,
        series,
        builder,
      };
    }
    if (!single?.y) {
      return {
        error: `Select Y dimension`,
        series,
        builder,
      };
    }

    let seriesIndex = 0;
    for (let frameIndex = 0; frameIndex < data.series.length; frameIndex++) {
      const frame = data.series[frameIndex];
      const xIndex = findFieldIndex(frame, single.x);
      if (xIndex != null) {
        const yIndex = findFieldIndex(frame, single.y);
        if (yIndex == null) {
          return {
            error: `Y must be in the same frame as X`,
            series,
            builder,
          };
        }
        const y = frame.fields[yIndex];
        let state = y.state ?? {};
        state.seriesIndex = seriesIndex++;
        y.state = state;

        // const disp =
        //   y.display ??
        //   getDisplayProcessor({
        //     field: y,
        //     theme: config.theme2,
        //     timeZone: tz,
        //   });

        const scatterConfig: ScatterFieldConfig = { ...defaultScatterConfig, ...y.config.custom };

        const name = getFieldDisplayName(y, frame, data.series);
        series.push({
          name,

          frame: (raw: DataFrame[]) => raw[frameIndex],

          x: (frame: DataFrame) => frame.fields[xIndex],
          y: (frame: DataFrame) => frame.fields[yIndex],
          legend: (frame: DataFrame) => {
            return [
              {
                label: name,
                color: '#f00', // single color for series?
                getItemKey: () => name,
                yAxis: yIndex, // << but not used
              },
            ];
          },

          line: scatterConfig.line!,
          lineWidth: scatterConfig.lineWidth!,
          lineStyle: scatterConfig.lineStyle!,
          lineColor: getColorValues(frame, yIndex, scatterConfig.lineColor),

          point: scatterConfig.point!,
          pointSize: getScaledValues(frame, yIndex, scatterConfig.pointSize),
          pointColor: getColorValues(frame, yIndex, scatterConfig.pointColor),
          pointSymbol: (frame: DataFrame, from?: number) => 'circle', // single field, multiple symbols.... kinda equals multiple series 🤔

          label: scatterConfig.label!,
          labelValue: getTextValues(frame, yIndex, scatterConfig.labelValue),
        });
        break; // only one for now
      }
    }
  }

  // TODO... setup uPlot config builder from the above scatter config

  return {
    series,
    builder,
  };
}

/**
 * This is called everytime the data changes
 *
 * from?  is this where we would support that?  -- need the previous values
 */
export function prepareScatterData(info: ScatterPanelInfo, data: DataFrame[], from?: number): FacetedData {
  if (info.error) {
    return [null];
  }
  return [
    null,
    ...info.series.map((s, idx) => {
      const frame = s.frame(data);
      // TODO obviously add color etc etc
      return [
        s.x(frame).values.toArray(), // X
        s.y(frame).values.toArray(), // Y
        s.pointSize(frame), // size
        s.pointColor(frame), // color
      ];
    }),
  ];
}

function getColorValues(
  frame: DataFrame,
  yIndex: number,
  cfg?: ColorDimensionConfig
): DimensionValues<CanvasRenderingContext2D['strokeStyle']> {
  let idx = findFieldIndex(frame, cfg?.field);
  if (idx == null) {
    if (cfg?.fixed) {
      return (frame: DataFrame, from?: number) => cfg.fixed;
    }
    idx = yIndex; // << use the y field color
  }

  // TODO: could be better :)
  return (frame: DataFrame, from?: number) => {
    const field = frame.fields[idx!];
    const dims = getColorDimensionForField(field, cfg!, config.theme2);
    return field.values.toArray().map((v, idx) => dims.get(idx));
  };
}

function getScaledValues(frame: DataFrame, yIndex: number, cfg?: ScaleDimensionConfig): DimensionValues<number> {
  let idx = findFieldIndex(frame, cfg?.field);
  if (idx == null) {
    if (cfg?.fixed) {
      return (frame: DataFrame, from?: number) => cfg.fixed;
    }
    idx = yIndex; // << use the y field color
  }

  // TODO: could be better :)
  return (frame: DataFrame, from?: number) => {
    const field = frame.fields[idx!];
    const dims = getScaledDimensionForField(field, cfg!);
    return field.values.toArray().map((v, idx) => dims.get(idx));
  };
}

function getTextValues(frame: DataFrame, yIndex: number, cfg?: TextDimensionConfig): DimensionValues<string> {
  let idx = findFieldIndex(frame, cfg?.field);
  if (idx == null) {
    if (cfg?.fixed) {
      return (frame: DataFrame, from?: number) => cfg.fixed;
    }
    idx = yIndex; // << use the y field color
  }

  // TODO: could be better :)
  return (frame: DataFrame, from?: number) => {
    const field = frame.fields[idx!];
    const dims = getTextDimensionForField(field, cfg!);
    return field.values.toArray().map((v, idx) => dims.get(idx));
  };
}
