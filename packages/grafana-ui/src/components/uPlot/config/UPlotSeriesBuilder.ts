import tinycolor from 'tinycolor2';
import uPlot from 'uplot';
import { PlotConfigBuilder } from '../types';

export interface SeriesProps {
  scaleKey: string;
  line?: boolean;
  lineColor?: string;
  lineWidth?: number;
  points?: boolean;
  pointSize?: number;
  pointColor?: string;
  fill?: boolean;
  fillOpacity?: number;
  fillColor?: string;
}

export class UPlotSeriesBuilder extends PlotConfigBuilder<SeriesProps, uPlot.Series> {
  getConfig() {
    const { line, lineColor, lineWidth, points, pointColor, pointSize, fillColor, fillOpacity, scaleKey } = this.props;

    const lineConfig = line
      ? {
          stroke: lineColor,
          width: lineWidth,
        }
      : {};

    const pointsConfig = points
      ? {
          points: {
            show: true,
            size: pointSize,
            stroke: pointColor,
          },
        }
      : {};

    const areaConfig =
      fillOpacity !== undefined
        ? {
            fill: tinycolor(fillColor)
              .setAlpha(fillOpacity)
              .toRgbString(),
          }
        : { fill: undefined };

    return {
      scale: scaleKey,
      ...lineConfig,
      ...pointsConfig,
      ...areaConfig,
    };
  }
}
