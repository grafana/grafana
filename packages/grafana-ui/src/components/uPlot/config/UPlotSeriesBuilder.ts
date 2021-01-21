import { FALLBACK_COLOR, FieldColorMode, GrafanaTheme, ThresholdsConfig } from '@grafana/data';
import tinycolor from 'tinycolor2';
import uPlot, { Series } from 'uplot';
import {
  DrawStyle,
  LineConfig,
  FillConfig,
  PointsConfig,
  PointVisibility,
  LineInterpolation,
  GraphGradientMode,
  BarConfig,
  BarAlignment,
} from '../config';
import { PlotConfigBuilder } from '../types';
import { DataFrameFieldIndex } from '@grafana/data';
import { getScaleGradientFn, getOpacityGradientFn, getHueGradientFn } from './gradientFills';

export interface SeriesProps extends LineConfig, BarConfig, FillConfig, PointsConfig {
  scaleKey: string;
  gradientMode?: GraphGradientMode;
  /** Used when gradientMode is set to Scheme */
  thresholds?: ThresholdsConfig;
  /** Used when gradientMode is set to Scheme  */
  colorMode?: FieldColorMode;
  fieldName: string;
  drawStyle: DrawStyle;
  show?: boolean;
  dataFrameFieldIndex?: DataFrameFieldIndex;
  hideInLegend?: boolean;
  theme: GrafanaTheme;
}

export class UPlotSeriesBuilder extends PlotConfigBuilder<SeriesProps, Series> {
  getConfig() {
    const {
      drawStyle,
      lineInterpolation,
      lineWidth,
      lineStyle,
      barAlignment,
      showPoints,
      pointColor,
      pointSize,
      scaleKey,
      spanNulls,
      show = true,
    } = this.props;

    let lineConfig: Partial<Series> = {};

    if (drawStyle === DrawStyle.Points) {
      lineConfig.paths = () => null;
    } else {
      lineConfig.stroke = this.getLineColor();
      lineConfig.width = lineWidth;
      if (lineStyle && lineStyle.fill !== 'solid') {
        if (lineStyle.fill === 'dot') {
          lineConfig.cap = 'round';
        }
        lineConfig.dash = lineStyle.dash ?? [10, 10];
      }
      lineConfig.paths = (self: uPlot, seriesIdx: number, idx0: number, idx1: number) => {
        let pathsBuilder = mapDrawStyleToPathBuilder(drawStyle, lineInterpolation, barAlignment);
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
    if (drawStyle === DrawStyle.Points) {
      pointsConfig.points!.show = true;
    } else {
      if (showPoints === PointVisibility.Auto) {
        if (drawStyle === DrawStyle.Bars) {
          pointsConfig.points!.show = false;
        }
      } else if (showPoints === PointVisibility.Never) {
        pointsConfig.points!.show = false;
      } else if (showPoints === PointVisibility.Always) {
        pointsConfig.points!.show = true;
      }
    }

    return {
      scale: scaleKey,
      spanGaps: spanNulls,
      show,
      fill: this.getFill(),
      ...lineConfig,
      ...pointsConfig,
    };
  }

  private getLineColor(): Series.Stroke {
    const { lineColor, gradientMode, colorMode, thresholds } = this.props;

    if (gradientMode === GraphGradientMode.Scheme) {
      return getScaleGradientFn(1, colorMode, thresholds);
    }

    return lineColor ?? FALLBACK_COLOR;
  }

  private getFill(): Series.Fill | undefined {
    const { lineColor, fillColor, gradientMode, fillOpacity, colorMode, thresholds, theme } = this.props;

    if (fillColor) {
      return fillColor;
    }

    const mode = gradientMode ?? GraphGradientMode.None;
    const opacityPercent = (fillOpacity ?? 0) / 100;

    switch (mode) {
      case GraphGradientMode.Opacity:
        return getOpacityGradientFn((fillColor ?? lineColor)!, opacityPercent);
      case GraphGradientMode.Hue:
        return getHueGradientFn((fillColor ?? lineColor)!, opacityPercent, theme);
      case GraphGradientMode.Scheme:
        return getScaleGradientFn(opacityPercent, colorMode, thresholds);
      default:
        if (opacityPercent > 0) {
          return tinycolor(lineColor).setAlpha(opacityPercent).toString();
        }
    }

    return undefined;
  }
}

interface PathBuilders {
  linear: Series.PathBuilder;
  smooth: Series.PathBuilder;
  stepBefore: Series.PathBuilder;
  stepAfter: Series.PathBuilder;
  barBefore: Series.PathBuilder;
  barCenter: Series.PathBuilder;
  barAfter: Series.PathBuilder;
}

const barWidthFactor = 0.6;
const barMaxWidth = Infinity;

const pathBuilders: PathBuilders = {
  linear: uPlot.paths.linear!(),
  smooth: uPlot.paths.spline!(),
  stepBefore: uPlot.paths.stepped!({ align: -1 }),
  stepAfter: uPlot.paths.stepped!({ align: 1 }),
  barBefore: uPlot.paths.bars!({ align: -1, size: [barWidthFactor, barMaxWidth] }),
  barCenter: uPlot.paths.bars!({ align: 0, size: [barWidthFactor, barMaxWidth] }),
  barAfter: uPlot.paths.bars!({ align: 1, size: [barWidthFactor, barMaxWidth] }),
};

function mapDrawStyleToPathBuilder(
  style: DrawStyle,
  lineInterpolation?: LineInterpolation,
  barAlignment?: BarAlignment
): Series.PathBuilder {
  if (style === DrawStyle.Bars) {
    if (barAlignment === BarAlignment.Before) {
      return pathBuilders.barBefore;
    }
    if (barAlignment === BarAlignment.Center) {
      return pathBuilders.barCenter;
    }
    if (barAlignment === BarAlignment.After) {
      return pathBuilders.barAfter;
    }
  }
  if (style === DrawStyle.Line) {
    if (lineInterpolation === LineInterpolation.StepBefore) {
      return pathBuilders.stepBefore;
    }
    if (lineInterpolation === LineInterpolation.StepAfter) {
      return pathBuilders.stepAfter;
    }
    if (lineInterpolation === LineInterpolation.Smooth) {
      return pathBuilders.smooth;
    }
  }

  return pathBuilders.linear; // the default
}
