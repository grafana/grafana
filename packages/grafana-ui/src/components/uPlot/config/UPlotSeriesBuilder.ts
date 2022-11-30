import uPlot, { Series } from 'uplot';

import {
  colorManipulator,
  DataFrameFieldIndex,
  FALLBACK_COLOR,
  FieldColorMode,
  FieldColorModeId,
  GrafanaTheme2,
  ThresholdsConfig,
} from '@grafana/data';
import {
  BarAlignment,
  BarConfig,
  GraphDrawStyle,
  FillConfig,
  GraphGradientMode,
  LineConfig,
  LineInterpolation,
  PointsConfig,
  VisibilityMode,
} from '@grafana/schema';

import { PlotConfigBuilder } from '../types';

import { getHueGradientFn, getOpacityGradientFn, getScaleGradientFn } from './gradientFills';

export interface SeriesProps extends LineConfig, BarConfig, FillConfig, PointsConfig {
  scaleKey: string;
  pxAlign?: boolean;
  gradientMode?: GraphGradientMode;
  dynamicSeriesColor?: (seriesIdx: number) => string | undefined;

  facets?: uPlot.Series.Facet[];

  /** Used when gradientMode is set to Scheme */
  thresholds?: ThresholdsConfig;
  colorMode?: FieldColorMode;
  hardMin?: number | null;
  hardMax?: number | null;
  softMin?: number | null;
  softMax?: number | null;

  drawStyle?: GraphDrawStyle;
  pathBuilder?: Series.PathBuilder | null;
  pointsFilter?: Series.Points.Filter | null;
  pointsBuilder?: Series.Points.Show | null;
  show?: boolean;
  dataFrameFieldIndex?: DataFrameFieldIndex;
  theme: GrafanaTheme2;
  value?: uPlot.Series.Value;
}

export class UPlotSeriesBuilder extends PlotConfigBuilder<SeriesProps, Series> {
  getConfig() {
    const {
      facets,
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

    let lineColor = this.getLineColor();

    // GraphDrawStyle.Points mode also needs this for fill/stroke sharing & re-use in series.points. see getColor() below.
    lineConfig.stroke = lineColor;

    if (pathBuilder != null) {
      lineConfig.paths = pathBuilder;
      lineConfig.width = lineWidth;
    } else if (drawStyle === GraphDrawStyle.Points) {
      lineConfig.paths = () => null;
    } else if (drawStyle != null) {
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

    const useColor: uPlot.Series.Stroke =
      // @ts-ignore
      typeof lineColor === 'string' ? lineColor : (u, seriesIdx) => u.series[seriesIdx]._stroke;

    const pointsConfig: Partial<Series> = {
      points: {
        stroke: useColor,
        fill: useColor,
        size: !pointSize || pointSize < lineWidth! ? undefined : pointSize,
        filter: pointsFilter,
      },
    };

    if (pointsBuilder != null) {
      pointsConfig.points!.show = pointsBuilder;
    } else {
      // we cannot set points.show property above (even to undefined) as that will clear uPlot's default auto behavior
      if (drawStyle === GraphDrawStyle.Points) {
        pointsConfig.points!.show = true;
      } else {
        if (showPoints === VisibilityMode.Auto) {
          if (drawStyle === GraphDrawStyle.Bars) {
            pointsConfig.points!.show = false;
          }
        } else if (showPoints === VisibilityMode.Never) {
          pointsConfig.points!.show = false;
        } else if (showPoints === VisibilityMode.Always) {
          pointsConfig.points!.show = true;
        }
      }
    }

    return {
      scale: scaleKey,
      facets,
      spanGaps: typeof spanNulls === 'number' ? false : spanNulls,
      value: () => '',
      pxAlign,
      show,
      fill: this.getFill(),
      ...lineConfig,
      ...pointsConfig,
    };
  }

  private getLineColor(): Series.Stroke {
    const {
      lineColor,
      gradientMode,
      colorMode,
      thresholds,
      theme,
      hardMin,
      hardMax,
      softMin,
      softMax,
      dynamicSeriesColor,
    } = this.props;

    if (gradientMode === GraphGradientMode.None && dynamicSeriesColor) {
      return (plot: uPlot, seriesIdx: number) => dynamicSeriesColor(seriesIdx) ?? lineColor ?? FALLBACK_COLOR;
    }

    if (gradientMode === GraphGradientMode.Scheme && colorMode?.id !== FieldColorModeId.Fixed) {
      return getScaleGradientFn(1, theme, colorMode, thresholds, hardMin, hardMax, softMin, softMax);
    }

    return lineColor ?? FALLBACK_COLOR;
  }

  private getFill(): Series.Fill | undefined {
    const {
      lineColor,
      fillColor,
      gradientMode,
      fillOpacity,
      colorMode,
      thresholds,
      theme,
      hardMin,
      hardMax,
      softMin,
      softMax,
      dynamicSeriesColor,
    } = this.props;

    if (fillColor) {
      return fillColor;
    }

    const mode = gradientMode ?? GraphGradientMode.None;
    const opacityPercent = (fillOpacity ?? 0) / 100;

    if (mode === GraphGradientMode.None && dynamicSeriesColor && opacityPercent > 0) {
      return (u: uPlot, seriesIdx: number) => {
        // @ts-ignore
        let lineColor = u.series[seriesIdx]._stroke; // cache
        return colorManipulator.alpha(lineColor ?? '', opacityPercent);
      };
    }

    switch (mode) {
      case GraphGradientMode.Opacity:
        return getOpacityGradientFn((fillColor ?? lineColor)!, opacityPercent);
      case GraphGradientMode.Hue:
        return getHueGradientFn((fillColor ?? lineColor)!, opacityPercent, theme);
      case GraphGradientMode.Scheme:
        if (colorMode?.id !== FieldColorModeId.Fixed) {
          return getScaleGradientFn(opacityPercent, theme, colorMode, thresholds, hardMin, hardMax, softMin, softMax);
        }
      // intentional fall-through to handle Scheme with Fixed color
      default:
        if (opacityPercent > 0) {
          return colorManipulator.alpha(lineColor ?? '', opacityPercent);
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
  style: GraphDrawStyle,
  lineInterpolation?: LineInterpolation,
  barAlignment = 0,
  barWidthFactor = 0.6,
  barMaxWidth = 200
): Series.PathBuilder {
  const pathBuilders = uPlot.paths;

  if (!builders) {
    // This should be global static, but Jest initalization was failing so we lazy load to avoid the issue
    builders = {
      linear: pathBuilders.linear!(),
      smooth: pathBuilders.spline!(),
      stepBefore: pathBuilders.stepped!({ align: -1, extend: true }),
      stepAfter: pathBuilders.stepped!({ align: 1, extend: true }),
    };
  }

  if (style === GraphDrawStyle.Bars) {
    // each bars pathBuilder is lazy-initialized and globally cached by a key composed of its options
    let barsCfgKey = `bars|${barAlignment}|${barWidthFactor}|${barMaxWidth}`;

    if (!builders[barsCfgKey]) {
      builders[barsCfgKey] = pathBuilders.bars!({
        size: [barWidthFactor, barMaxWidth],
        align: barAlignment as BarAlignment,
      });
    }

    return builders[barsCfgKey];
  } else if (style === GraphDrawStyle.Line) {
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
