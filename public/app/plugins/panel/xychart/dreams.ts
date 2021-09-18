import { DataFrame, Field, PanelData, TimeZone } from '@grafana/data';
import { LineStyle, VisibilityMode } from '@grafana/schema';
import { DimensionValues, UPlotConfigBuilder } from '@grafana/ui';
import { FacetedData } from '@grafana/ui/src/components/uPlot/types';
import { ScatterLineMode, XYChartOptions } from './models.gen';

export interface LegendInfo {
  color: CanvasRenderingContext2D['strokeStyle'];
  text: string;
  symbol: string;
  openEditor?: (evt: any) => void;
}

// Using field where we will need formatting/scale/axis info
// Use raw or DimensionValues when the values can be used directly
export interface ScatterSeries {
  name: string;

  frame: (raw: DataFrame[]) => DataFrame;

  x: (frame: DataFrame) => Field;
  y: (frame: DataFrame) => Field;
  tooltip: (frame: DataFrame) => Field[];
  legend: (frame: DataFrame) => LegendInfo[]; // could be single if symbol is constant

  line: ScatterLineMode;
  lineWidth: number;
  lineStyle: LineStyle;
  lineColor: (frame: DataFrame) => CanvasRenderingContext2D['strokeStyle']; // gradients may need dynamic min/max

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
export function prpareScatterPlot(options: XYChartOptions, data: PanelData, tz: TimeZone): ScatterPanelInfo {
  if (!options.series?.length) {
    return {
      error: 'missing data',
    } as ScatterPanelInfo;
  }
  const series: ScatterSeries[] = [];
  // TODO use configs to construct series
  // multiple series may exist across incoming frames

  const builder = new UPlotConfigBuilder(tz);

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
export function prepareScatterFacets(series: ScatterSeries[], data: DataFrame[], from?: number): FacetedData {
  return [
    null,
    ...series.map((s, idx) => {
      const frame = s.frame(data);
      const x = s.x(frame).values.toArray();
      const y = s.x(frame).values.toArray();
      return [x, y]; // TODO obviously
    }),
  ];
}
