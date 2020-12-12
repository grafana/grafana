import tinycolor from 'tinycolor2';
import uPlot, { Series } from 'uplot';
import { DrawStyle, LineConfig, AreaConfig, PointsConfig, PointVisibility, LineInterpolation } from '../config';
import { PlotConfigBuilder } from '../types';

const pathBuilders = uPlot.paths;

const barWidthFactor = 0.6;
const barMaxWidth = Infinity;

const barsBuilder = pathBuilders.bars!({ size: [barWidthFactor, barMaxWidth] });
const linearBuilder = pathBuilders.linear!();
const smoothBuilder = pathBuilders.spline!();
const stepBeforeBuilder = pathBuilders.stepped!({ align: -1 });
const stepAfterBuilder = pathBuilders.stepped!({ align: 1 });

export interface SeriesProps extends LineConfig, AreaConfig, PointsConfig {
  drawStyle: DrawStyle;
  scaleKey: string;
}

export class UPlotSeriesBuilder extends PlotConfigBuilder<SeriesProps, Series> {
  getConfig() {
    const {
      drawStyle,
      lineInterpolation,
      lineColor,
      lineWidth,
      showPoints,
      pointColor,
      pointSize,
      fillColor,
      fillOpacity,
      scaleKey,
      spanNulls,
    } = this.props;

    let lineConfig: Partial<Series> = {};

    if (drawStyle === DrawStyle.Points) {
      lineConfig.paths = () => null;
    } else {
      lineConfig.stroke = lineColor;
      lineConfig.width = lineWidth;
      lineConfig.paths = (self: uPlot, seriesIdx: number, idx0: number, idx1: number) => {
        let pathsBuilder = linearBuilder;

        if (drawStyle === DrawStyle.Bars) {
          pathsBuilder = barsBuilder;
        } else if (drawStyle === DrawStyle.Line) {
          if (lineInterpolation === LineInterpolation.StepBefore) {
            pathsBuilder = stepBeforeBuilder;
          } else if (lineInterpolation === LineInterpolation.StepAfter) {
            pathsBuilder = stepAfterBuilder;
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
    if (showPoints === PointVisibility.Auto) {
      if (drawStyle === DrawStyle.Bars) {
        pointsConfig.points!.show = false;
      }
    } else if (showPoints === PointVisibility.Never) {
      pointsConfig.points!.show = false;
    } else if (showPoints === PointVisibility.Always) {
      pointsConfig.points!.show = true;
    }

    let fillConfig: any | undefined;
    if (fillColor && fillOpacity !== 0) {
      fillConfig = {
        fill: fillOpacity
          ? tinycolor(fillColor)
              .setAlpha(fillOpacity)
              .toRgbString()
          : fillColor,
      };
    }

    return {
      scale: scaleKey,
      spanGaps: spanNulls,
      ...lineConfig,
      ...pointsConfig,
      ...fillConfig,
    };
  }
}
