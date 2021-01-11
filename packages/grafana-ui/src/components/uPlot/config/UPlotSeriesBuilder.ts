import tinycolor from 'tinycolor2';
import uPlot, { Series } from 'uplot';
import { getCanvasContext } from '../../../utils/measureText';
import {
  DrawStyle,
  LineConfig,
  FillConfig,
  LineInterpolation,
  PointsConfig,
  PointSymbol,
  PointVisibility,
  FillGradientMode,
} from '../config';
import { PlotConfigBuilder } from '../types';

export interface SeriesProps extends LineConfig, FillConfig, PointsConfig {
  drawStyle: DrawStyle;
  scaleKey: string;
  show?: boolean;
}

export class UPlotSeriesBuilder extends PlotConfigBuilder<SeriesProps, Series> {
  getConfig() {
    const {
      drawStyle,
      lineInterpolation,
      lineColor,
      lineWidth,
      lineStyle,
      showPoints,
      pointColor,
      pointSize,
      pointSymbol,
      scaleKey,
      spanNulls,
      show = true,
    } = this.props;

    let lineConfig: Partial<Series> = {};

    if (drawStyle === DrawStyle.Points) {
      lineConfig.paths = () => null;
    } else {
      lineConfig.stroke = lineColor;
      lineConfig.width = lineWidth;
      if (lineStyle && lineStyle.fill !== 'solid') {
        if (lineStyle.fill === 'dot') {
          // lineConfig.dashCap = 'round'; // square or butt
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
    if (showPoints === PointVisibility.Auto) {
      if (drawStyle === DrawStyle.Bars) {
        pointsConfig.points!.show = false;
      }
    } else if (showPoints === PointVisibility.Never) {
      pointsConfig.points!.show = false;
    } else if (showPoints === PointVisibility.Always) {
      pointsConfig.points!.show = true;
    }

    if (pointsConfig.points!.show) {
      if (pointSymbol && pointSymbol !== PointSymbol.Dot) {
        pointsConfig.points!.show = getCustomPointRenderer(pointSymbol, pointColor!, pointSize!);
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

  getFill(): Series.Fill | undefined {
    const { lineColor, fillColor, fillGradient, fillOpacity } = this.props;

    if (fillColor) {
      return fillColor;
    }

    const mode = fillGradient ?? FillGradientMode.None;
    let fillOpacityNumber = fillOpacity ?? 0;

    if (mode !== FillGradientMode.None) {
      return getCanvasGradient({
        color: (fillColor ?? lineColor)!,
        opacity: fillOpacityNumber / 100,
        mode,
      });
    }

    if (fillOpacityNumber > 0) {
      return tinycolor(lineColor)
        .setAlpha(fillOpacityNumber / 100)
        .toString();
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

interface AreaGradientOptions {
  color: string;
  mode: FillGradientMode;
  opacity: number;
}

function getCanvasGradient(opts: AreaGradientOptions): (self: uPlot, seriesIdx: number) => CanvasGradient {
  return (plot: uPlot, seriesIdx: number) => {
    const { color, mode, opacity } = opts;

    const ctx = getCanvasContext();
    const gradient = ctx.createLinearGradient(0, plot.bbox.top, 0, plot.bbox.top + plot.bbox.height);

    switch (mode) {
      case FillGradientMode.Hue:
        const color1 = tinycolor(color)
          .spin(-25)
          .darken(30)
          .setAlpha(opacity)
          .toRgbString();
        const color2 = tinycolor(color)
          .spin(25)
          .lighten(35)
          .setAlpha(opacity)
          .toRgbString();
        gradient.addColorStop(0, color2);
        gradient.addColorStop(1, color1);

      case FillGradientMode.Opacity:
      default:
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
    }
  };
}

function getCustomPointRenderer(shape: PointSymbol, color: string, size: number) {
  let shapeSize: number;
  let drawFn: (ctx: CanvasRenderingContext2D, cx: number, cy: number, height: number) => void;

  switch (shape) {
    case PointSymbol.Star:
      shapeSize = size * 1.5;
      drawFn = drawStar;
      break;
    case PointSymbol.Square:
      shapeSize = size * 2;
      drawFn = drawSquare;
      break;
    case PointSymbol.Triangle:
      shapeSize = size * 3;
      drawFn = drawTriangle;
      break;
    case PointSymbol.Marble:
      shapeSize = size * 3;
      drawFn = drawMarble;
      break;
    case PointSymbol.Cross:
      shapeSize = size * 2;
      drawFn = drawCross;
      break;
  }

  return (u: uPlot, seriesIdx: number, idx0: number, idx1: number) => {
    const series = u.series[seriesIdx];
    const { ctx } = u;
    const { scale } = series;
    let j = idx0;
    ctx.fillStyle = color;

    while (j <= idx1) {
      let val = u.data[seriesIdx][j];
      let cx = Math.round(u.valToPos(u.data[0][j], 'x', true));
      let cy = Math.round(u.valToPos(val!, scale!, true));
      drawFn!(ctx, cx, cy, shapeSize!);
      ctx.fill();
      j++;
    }

    return undefined;
  };
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  let step = Math.PI / 5;

  ctx.beginPath();
  ctx.moveTo(cx, cy - size);

  for (let i = 0; i < 5; i++) {
    x = cx + Math.cos(rot) * size;
    y = cy + Math.sin(rot) * size;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + (Math.cos(rot) * size) / 2;
    y = cy + (Math.sin(rot) * size) / 2;
    ctx.lineTo(x, y);
    rot += step;
  }

  ctx.lineTo(cx, cy - size);
  ctx.closePath();
}

function drawSquare(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  ctx.rect(cx - size / 2, cy - size / 2, size, size);
  ctx.closePath();
}

function drawMarble(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(cx - size / 2, cy);
  ctx.lineTo(cx, cy + size / 2);
  ctx.lineTo(cx + size / 2, cy);
  ctx.lineTo(cx, cy - size / 2);
  ctx.closePath();
}

function drawTriangle(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  let height = (size * Math.sqrt(3)) / 2;
  ctx.beginPath();
  ctx.moveTo(cx - size / 2, cy + height / 2);
  ctx.lineTo(cx + size / 2, cy + height / 2);
  ctx.lineTo(cx, cy - height / 2);
  ctx.closePath();
}

function drawCross(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  ctx.fillRect(cx - size / 2, cy - size / 8, size, size / 4);
  ctx.fillRect(cx - size / 8, cy - size / 2, size / 4, size);
  ctx.closePath();
}
