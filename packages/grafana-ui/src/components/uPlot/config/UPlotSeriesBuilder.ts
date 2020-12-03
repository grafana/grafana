import tinycolor from 'tinycolor2';
import uPlot, { Series } from 'uplot';
import { GraphMode, LineConfig, AreaConfig, PointsConfig, PointMode, LineInterpolation } from '../config';
import { barsBuilder, smoothBuilder, staircaseBuilder } from '../paths';
import { PlotConfigBuilder } from '../types';

export interface SeriesProps extends LineConfig, AreaConfig, PointsConfig {
  mode: GraphMode;
  scaleKey: string;
}

export class UPlotSeriesBuilder extends PlotConfigBuilder<SeriesProps, Series> {
  getConfig() {
    const {
      mode,
      lineInterpolation,
      lineColor,
      lineWidth,
      points,
      pointColor,
      pointSize,
      fillColor,
      fillOpacity,
      scaleKey,
    } = this.props;

    let lineConfig: Partial<Series> = {};

    if (mode === GraphMode.Points) {
      lineConfig.paths = () => null;
    } else {
      lineConfig.stroke = lineColor;
      lineConfig.width = lineWidth;
      lineConfig.paths = (self: uPlot, seriesIdx: number, idx0: number, idx1: number) => {
        let pathsBuilder = self.paths;

        if (mode === GraphMode.Bars) {
          pathsBuilder = barsBuilder;
        } else if (mode === GraphMode.Line) {
          if (lineInterpolation === LineInterpolation.Staircase) {
            pathsBuilder = staircaseBuilder;
          } else if (lineInterpolation === LineInterpolation.Smooth) {
            pathsBuilder = smoothBuilder;
          }
        }

        return pathsBuilder(self, seriesIdx, idx0, idx1);
      };
    }

    const pointsConfig: Partial<Series> = {
      points: {
        stroke: pointColor,
        fill: pointColor,
        size: pointSize,
      },
    };

    // we cannot set points.show property above (even to undefined) as that will clear uPlot's default auto behavior
    if (points === PointMode.Auto) {
      if (mode === GraphMode.Bars) {
        pointsConfig.points!.show = false;
      }
    } else if (points === PointMode.Never) {
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
