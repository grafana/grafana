import tinycolor from 'tinycolor2';
import uPlot, { Series } from 'uplot';
import { DrawStyle, LineConfig, AreaConfig, PointsConfig, PointVisibility, LineInterpolation } from '../config';
import { PlotConfigBuilder } from '../types';

const barWidthFactor = 0.6;
const barMaxWidth = Infinity;

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
        let builderConfig;

        if (drawStyle === DrawStyle.Bars) {
          builderConfig = { size: [barWidthFactor, barMaxWidth] };
        } else if (drawStyle === DrawStyle.Line) {
          if (lineInterpolation === LineInterpolation.StepBefore) {
            builderConfig = { align: -1 };
          } else if (lineInterpolation === LineInterpolation.StepAfter) {
            builderConfig = { align: 1 };
          }
        }

        let pathsBuilder = mapDrawStyleToPathBuilder(drawStyle, lineInterpolation, builderConfig);
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
    let fillOpacityNumber = fillOpacity ?? 0;

    if (fillColor) {
      fillConfig = {
        fill: fillColor,
      };
    }

    if (fillOpacityNumber !== 0) {
      fillConfig = {
        fill: tinycolor(fillColor ?? lineColor)
          .setAlpha(fillOpacityNumber / 100)
          .toRgbString(),
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

interface PathBuilders {
  bars: Series.PathBuilder;
  linear: Series.PathBuilder;
  smooth: Series.PathBuilder;
  stepBefore: Series.PathBuilder;
  stepAfter: Series.PathBuilder;
}

let builders: PathBuilders | undefined = undefined;

function mapDrawStyleToPathBuilder(
  style: DrawStyle,
  lineInterpolation?: LineInterpolation,
  opts?: any
): Series.PathBuilder {
  // Initalize the builders once
  if (!builders) {
    const pathBuilders = uPlot.paths;
    const barWidthFactor = 0.6;
    const barMaxWidth = Infinity;

    builders = {
      bars: pathBuilders.bars!({ size: [barWidthFactor, barMaxWidth] }),
      linear: pathBuilders.linear!(),
      smooth: pathBuilders.spline!(),
      stepBefore: pathBuilders.stepped!({ align: -1 }),
      stepAfter: pathBuilders.stepped!({ align: 1 }),
    };
  }

  if (style === DrawStyle.Bars) {
    return builders.bars;
  }
  if (style === DrawStyle.Line) {
    if (lineInterpolation === LineInterpolation.StepBefore) {
      return builders.stepBefore;
    }
    if (lineInterpolation === LineInterpolation.StepAfter) {
      return builders.stepAfter;
    }
    if (lineInterpolation === LineInterpolation.Smooth) {
      return builders.smooth;
    }
  }

  return builders.linear; // the default
}
