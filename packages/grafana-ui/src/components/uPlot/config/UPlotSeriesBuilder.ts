import { DataFrameFieldIndex, FALLBACK_COLOR, FieldColorMode, GrafanaTheme2, ThresholdsConfig } from '@grafana/data';
import tinycolor from 'tinycolor2';
import uPlot, { Series } from 'uplot';
import {
  BarAlignment,
  BarConfig,
  DrawStyle,
  FillConfig,
  GraphGradientMode,
  LineConfig,
  LineInterpolation,
  PointsConfig,
  PointVisibility,
} from '../config';
import { PlotConfigBuilder } from '../types';
import { getHueGradientFn, getOpacityGradientFn, getScaleGradientFn } from './gradientFills';

export interface SeriesProps extends LineConfig, BarConfig, FillConfig, PointsConfig {
  scaleKey: string;
  pxAlign?: boolean;
  gradientMode?: GraphGradientMode;
  /** Used when gradientMode is set to Scheme */
  thresholds?: ThresholdsConfig;
  /** Used when gradientMode is set to Scheme  */
  colorMode?: FieldColorMode;
  drawStyle?: DrawStyle;
  pathBuilder?: Series.PathBuilder;
  pointsFilter?: Series.Points.Filter;
  pointsBuilder?: Series.Points.Show;
  show?: boolean;
  dataFrameFieldIndex?: DataFrameFieldIndex;
  theme: GrafanaTheme2;
}

export class UPlotSeriesBuilder extends PlotConfigBuilder<SeriesProps, Series> {
  getConfig() {
    const {
      drawStyle,
      pathBuilder,
      pointsBuilder,
      pointsFilter,
      lineInterpolation,
      lineWidth,
      lineStyle,
      barAlignment,
      barWidthFactor,
      barMaxWidth,
      showPoints,
      pointSize,
      scaleKey,
      pxAlign,
      spanNulls,
      show = true,
    } = this.props;

    let lineConfig: Partial<Series> = {};
    const lineColor = this.getLineColor();

    if (pathBuilder != null) {
      lineConfig.paths = pathBuilder;
      lineConfig.stroke = lineColor;
      lineConfig.width = lineWidth;
    } else if (drawStyle === DrawStyle.Points) {
      lineConfig.paths = () => null;
    } else if (drawStyle != null) {
      lineConfig.stroke = lineColor;
      lineConfig.width = lineWidth;
      if (lineStyle && lineStyle.fill !== 'solid') {
        if (lineStyle.fill === 'dot') {
          lineConfig.cap = 'round';
        }
        lineConfig.dash = lineStyle.dash ?? [10, 10];
      }
      lineConfig.paths = (self: uPlot, seriesIdx: number, idx0: number, idx1: number) => {
        let pathsBuilder = mapDrawStyleToPathBuilder(
          drawStyle,
          lineInterpolation,
          barAlignment,
          barWidthFactor,
          barMaxWidth
        );
        return pathsBuilder(self, seriesIdx, idx0, idx1);
      };
    }

    const pointsConfig: Partial<Series> = {
      points: {
        stroke: lineColor,
        fill: lineColor,
        size: pointSize,
        filter: pointsFilter,
      },
    };

    if (pointsBuilder != null) {
      pointsConfig.points!.show = pointsBuilder;
    } else {
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
    }

    return {
      scale: scaleKey,
      spanGaps: typeof spanNulls === 'number' ? false : spanNulls,
      pxAlign,
      show,
      fill: this.getFill(),
      ...lineConfig,
      ...pointsConfig,
    };
  }

  private getLineColor(): Series.Stroke {
    const { lineColor, gradientMode, colorMode, thresholds, theme } = this.props;

    if (gradientMode === GraphGradientMode.Scheme) {
      return getScaleGradientFn(1, theme, colorMode, thresholds);
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
        return getScaleGradientFn(opacityPercent, theme, colorMode, thresholds);
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
  [key: string]: Series.PathBuilder;
}

let builders: PathBuilders | undefined = undefined;

function mapDrawStyleToPathBuilder(
  style: DrawStyle,
  lineInterpolation?: LineInterpolation,
  barAlignment = 0,
  barWidthFactor = 0.6,
  barMaxWidth = Infinity
): Series.PathBuilder {
  const pathBuilders = uPlot.paths;

  if (!builders) {
    // This should be global static, but Jest initalization was failing so we lazy load to avoid the issue
    builders = {
      linear: pathBuilders.linear!(),
      smooth: pathBuilders.spline!(),
      stepBefore: pathBuilders.stepped!({ align: -1 }),
      stepAfter: pathBuilders.stepped!({ align: 1 }),
    };
  }

  if (style === DrawStyle.Bars) {
    // each bars pathBuilder is lazy-initialized and globally cached by a key composed of its options
    let barsCfgKey = `bars|${barAlignment}|${barWidthFactor}|${barMaxWidth}`;

    if (!builders[barsCfgKey]) {
      builders[barsCfgKey] = pathBuilders.bars!({
        size: [barWidthFactor, barMaxWidth],
        align: barAlignment as BarAlignment,
      });
    }

    return builders[barsCfgKey];
  } else if (style === DrawStyle.Line) {
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
