import { FALLBACK_COLOR, FieldColorMode, getColorForTheme, ThresholdsConfig } from '@grafana/data';
import tinycolor from 'tinycolor2';
import uPlot, { Series } from 'uplot';
import darkTheme from '../../../themes/dark';
import { getCanvasContext } from '../../../utils/measureText';
import {
  DrawStyle,
  LineConfig,
  FillConfig,
  PointsConfig,
  PointVisibility,
  LineInterpolation,
  GraphGradientMode,
} from '../config';
import { PlotConfigBuilder } from '../types';
import { DataFrameFieldIndex } from '@grafana/data';

export interface SeriesProps extends LineConfig, FillConfig, PointsConfig {
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
}

export class UPlotSeriesBuilder extends PlotConfigBuilder<SeriesProps, Series> {
  getConfig() {
    const {
      drawStyle,
      lineInterpolation,
      lineWidth,
      lineStyle,
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
        let pathsBuilder = mapDrawStyleToPathBuilder(drawStyle, lineInterpolation);
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
    const { lineColor, fillColor, gradientMode, fillOpacity, colorMode, thresholds } = this.props;

    if (fillColor) {
      return fillColor;
    }

    const mode = gradientMode ?? GraphGradientMode.None;
    const opacityPercent = (fillOpacity ?? 0) / 100;

    switch (mode) {
      case GraphGradientMode.Opacity:
        return getOpacityGradientFn((fillColor ?? lineColor)!, opacityPercent);
      case GraphGradientMode.Hue:
        return getHueGradientFn((fillColor ?? lineColor)!, opacityPercent);
      case GraphGradientMode.Scheme:
        return getScaleGradientFn(opacityPercent, colorMode, thresholds);
      default:
        if (opacityPercent > 0) {
          return tinycolor(lineColor)
            .setAlpha(opacityPercent)
            .toString();
        }
    }

    return undefined;
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
  // This should be global static, but Jest initalization was failing so we lazy load to avoid the issue
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

function getOpacityGradientFn(color: string, opacity: number): (self: uPlot, seriesIdx: number) => CanvasGradient {
  return (plot: uPlot, seriesIdx: number) => {
    const ctx = getCanvasContext();
    const gradient = ctx.createLinearGradient(0, plot.bbox.top, 0, plot.bbox.top + plot.bbox.height);

    gradient.addColorStop(
      0,
      tinycolor(color)
        .setAlpha(opacity)
        .toRgbString()
    );
    gradient.addColorStop(
      1,
      tinycolor(color)
        .setAlpha(0)
        .toRgbString()
    );

    return gradient;
  };
}

function getHueGradientFn(color: string, opacity: number): (self: uPlot, seriesIdx: number) => CanvasGradient {
  return (plot: uPlot, seriesIdx: number) => {
    const ctx = getCanvasContext();
    const gradient = ctx.createLinearGradient(0, plot.bbox.top, 0, plot.bbox.top + plot.bbox.height);
    const color1 = tinycolor(color)
      .spin(-25)
      .darken(30)
      .setAlpha(opacity)
      .toString();
    const color2 = tinycolor(color)
      .spin(25)
      .lighten(35)
      .setAlpha(opacity)
      .toString();

    gradient.addColorStop(0, color2);
    gradient.addColorStop(1, color1);

    return gradient;
  };
}

/**
 * Experimental & quick and dirty test
 */
function getScaleGradientFn(
  opacity: number,
  colorMode?: FieldColorMode,
  thresholds?: ThresholdsConfig
): (self: uPlot, seriesIdx: number) => CanvasGradient {
  if (!colorMode) {
    throw Error('Missing colorMode required for color scheme gradients');
  }

  if (!thresholds) {
    throw Error('Missing thresholds required for color scheme gradients');
  }

  return (plot: uPlot, seriesIdx: number) => {
    const ctx = getCanvasContext();
    const gradient = ctx.createLinearGradient(0, plot.bbox.top, 0, plot.bbox.top + plot.bbox.height);
    const series = plot.series[seriesIdx];
    const scale = plot.scales[series.scale!];
    const range = plot.bbox.height;

    console.log('scale', scale);
    console.log('series.min', series.min);
    console.log('series.max', series.max);

    const getColorWithAlpha = (color: string) => {
      return tinycolor(getColorForTheme(color, darkTheme))
        .setAlpha(opacity)
        .toString();
    };

    const addColorStop = (value: number, color: string) => {
      const pos = plot.valToPos(value, series.scale!);
      const percent = pos / range;
      console.log(`addColorStop(value = ${value}, xPos=${pos})`);
      gradient.addColorStop(Math.min(percent, 1), getColorWithAlpha(color));
    };

    for (let idx = 0; idx < thresholds.steps.length; idx++) {
      const step = thresholds.steps[idx];
      const value = step.value === -Infinity ? 0 : step.value;
      addColorStop(value, step.color);

      // to make the gradient discrete
      if (thresholds.steps.length > idx + 1) {
        addColorStop(thresholds.steps[idx + 1].value - 0.0000001, step.color);
      }
    }

    return gradient;
  };
}
