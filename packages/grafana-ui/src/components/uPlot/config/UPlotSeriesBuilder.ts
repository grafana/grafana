import tinycolor from 'tinycolor2';
import { Series } from 'uplot';
import { PointMode } from '../config';
import { PlotConfigBuilder } from '../types';

export interface SeriesProps {
  scaleKey: string;
  line?: boolean;
  lineColor?: string;
  lineWidth?: number;
  points?: PointMode;
  pointSize?: number;
  pointColor?: string;
  fill?: boolean;
  fillOpacity?: number;
  fillColor?: string;
}

export class UPlotSeriesBuilder extends PlotConfigBuilder<SeriesProps, Series> {
  getConfig() {
    const { line, lineColor, lineWidth, points, pointColor, pointSize, fillColor, fillOpacity, scaleKey } = this.props;

    const lineConfig = line
      ? {
          stroke: lineColor,
          width: lineWidth,
        }
      : {};

    const pointsConfig: Partial<Series> = {
      points: {
        stroke: pointColor,
        fill: pointColor,
        size: pointSize,
      },
    };

    // we cannot set points.show property above (even to undefined) as that will clear uPlot's default auto behavior
    if (points === PointMode.Never) {
      pointsConfig.points!.show = false;
    } else if (points === PointMode.Always) {
      pointsConfig.points!.show = true;
    }

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
