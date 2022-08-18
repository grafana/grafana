import tinycolor from 'tinycolor2';
import uPlot from 'uplot';

import {
  colorManipulator,
  FieldColorMode,
  FieldColorModeId,
  GrafanaTheme2,
  ThresholdsConfig,
  ThresholdsMode,
} from '@grafana/data';
import { ScaleOrientation } from '@grafana/schema';

import { getCanvasContext } from '../../../utils/measureText';

function makeDirectionalGradient(direction: GradientDirection, bbox: uPlot.BBox, ctx: CanvasRenderingContext2D) {
  let x0 = 0,
    y0 = 0,
    x1 = 0,
    y1 = 0;

  if (direction === GradientDirection.Down) {
    y0 = bbox.top;
    y1 = bbox.top + bbox.height;
  } else if (direction === GradientDirection.Left) {
    x0 = bbox.left + bbox.width;
    x1 = bbox.left;
  } else if (direction === GradientDirection.Up) {
    y0 = bbox.top + bbox.height;
    y1 = bbox.top;
  } else if (direction === GradientDirection.Right) {
    x0 = bbox.left;
    x1 = bbox.left + bbox.width;
  }

  return ctx.createLinearGradient(x0, y0, x1, y1);
}

export function getOpacityGradientFn(
  color: string,
  opacity: number
): (self: uPlot, seriesIdx: number) => CanvasGradient {
  return (plot: uPlot, seriesIdx: number) => {
    const ctx = getCanvasContext();
    const gradient = makeDirectionalGradient(
      plot.scales.x!.ori === ScaleOrientation.Horizontal ? GradientDirection.Down : GradientDirection.Left,
      plot.bbox,
      ctx
    );

    gradient.addColorStop(0, colorManipulator.alpha(color, opacity));
    gradient.addColorStop(1, colorManipulator.alpha(color, 0));

    return gradient;
  };
}

export function getHueGradientFn(
  color: string,
  opacity: number,
  theme: GrafanaTheme2
): (self: uPlot, seriesIdx: number) => CanvasGradient {
  return (plot: uPlot, seriesIdx: number) => {
    const ctx = getCanvasContext();
    const gradient = makeDirectionalGradient(
      plot.scales.x!.ori === ScaleOrientation.Horizontal ? GradientDirection.Down : GradientDirection.Left,
      plot.bbox,
      ctx
    );

    const color1 = tinycolor(color).spin(-15);
    const color2 = tinycolor(color).spin(15);

    if (theme.isDark) {
      gradient.addColorStop(0, color2.lighten(10).setAlpha(opacity).toString());
      gradient.addColorStop(1, color1.darken(10).setAlpha(opacity).toString());
    } else {
      gradient.addColorStop(0, color2.lighten(10).setAlpha(opacity).toString());
      gradient.addColorStop(1, color1.setAlpha(opacity).toString());
    }

    return gradient;
  };
}

export enum GradientDirection {
  Right = 0,
  Up = 1,
  Left = 2,
  Down = 3,
}

type ValueStop = [value: number, color: string];

type ScaleValueStops = ValueStop[];

export function scaleGradient(u: uPlot, scaleKey: string, scaleStops: ScaleValueStops, discrete = false) {
  let scale = u.scales[scaleKey];

  // we want the stop below or at the scaleMax
  // and the stop below or at the scaleMin, else the stop above scaleMin
  let minStopIdx: number | null = null;
  let maxStopIdx: number | null = null;

  for (let i = 0; i < scaleStops.length; i++) {
    let stopVal = scaleStops[i][0];

    if (stopVal <= scale.min! || minStopIdx == null) {
      minStopIdx = i;
    }

    maxStopIdx = i;

    if (stopVal >= scale.max!) {
      break;
    }
  }

  if (minStopIdx === maxStopIdx) {
    return scaleStops[minStopIdx!][1];
  }

  let minStopVal = scaleStops[minStopIdx!][0];
  let maxStopVal = scaleStops[maxStopIdx!][0];

  if (minStopVal === -Infinity) {
    minStopVal = scale.min!;
  }

  if (maxStopVal === Infinity) {
    maxStopVal = scale.max!;
  }

  let minStopPos = Math.round(u.valToPos(minStopVal, scaleKey, true));
  let maxStopPos = Math.round(u.valToPos(maxStopVal, scaleKey, true));

  let range = minStopPos - maxStopPos;

  if (range === 0) {
    return scaleStops[maxStopIdx!][1];
  }

  let x0, y0, x1, y1;

  if (u.scales.x!.ori === ScaleOrientation.Horizontal) {
    x0 = x1 = 0;
    y0 = minStopPos;
    y1 = maxStopPos;
  } else {
    y0 = y1 = 0;
    x0 = minStopPos;
    x1 = maxStopPos;
  }

  let ctx = getCanvasContext();

  let grd = ctx.createLinearGradient(x0, y0, x1, y1);

  let prevColor: string;

  for (let i = minStopIdx!; i <= maxStopIdx!; i++) {
    let s = scaleStops[i];

    let stopPos =
      i === minStopIdx ? minStopPos : i === maxStopIdx ? maxStopPos : Math.round(u.valToPos(s[0], scaleKey, true));

    let pct = (minStopPos - stopPos) / range;

    if (discrete && i > minStopIdx!) {
      grd.addColorStop(pct, prevColor!);
    }

    grd.addColorStop(pct, (prevColor = s[1]));
  }

  return grd;
}

export function getDataRange(plot: uPlot, scaleKey: string) {
  let sc = plot.scales[scaleKey];

  let min = Infinity;
  let max = -Infinity;

  plot.series.forEach((ser, seriesIdx) => {
    if (ser.show && ser.scale === scaleKey) {
      // uPlot skips finding data min/max when a scale has a pre-defined range
      if (ser.min == null) {
        let data = plot.data[seriesIdx];
        for (let i = 0; i < data.length; i++) {
          if (data[i] != null) {
            min = Math.min(min, data[i]!);
            max = Math.max(max, data[i]!);
          }
        }
      } else {
        min = Math.min(min, ser.min!);
        max = Math.max(max, ser.max!);
      }
    }
  });

  if (max === min) {
    min = sc.min!;
    max = sc.max!;
  }

  return [min, max];
}

export function getGradientRange(
  u: uPlot,
  scaleKey: string,
  hardMin?: number | null,
  hardMax?: number | null,
  softMin?: number | null,
  softMax?: number | null
) {
  let min = hardMin ?? softMin ?? null;
  let max = hardMax ?? softMax ?? null;

  if (min == null || max == null) {
    let [dataMin, dataMax] = getDataRange(u, scaleKey);

    min = min ?? dataMin ?? 0;
    max = max ?? dataMax ?? 100;
  }

  return [min, max];
}

export function getScaleGradientFn(
  opacity: number,
  theme: GrafanaTheme2,
  colorMode?: FieldColorMode,
  thresholds?: ThresholdsConfig,
  hardMin?: number | null,
  hardMax?: number | null,
  softMin?: number | null,
  softMax?: number | null
): (self: uPlot, seriesIdx: number) => CanvasGradient | string {
  if (!colorMode) {
    throw Error('Missing colorMode required for color scheme gradients');
  }

  if (!thresholds) {
    throw Error('Missing thresholds required for color scheme gradients');
  }

  return (plot: uPlot, seriesIdx: number) => {
    let scaleKey = plot.series[seriesIdx].scale!;

    let gradient: CanvasGradient | string = '';

    if (colorMode.id === FieldColorModeId.Thresholds) {
      if (thresholds.mode === ThresholdsMode.Absolute) {
        const valueStops = thresholds.steps.map(
          (step) =>
            [step.value, colorManipulator.alpha(theme.visualization.getColorByName(step.color), opacity)] as ValueStop
        );
        gradient = scaleGradient(plot, scaleKey, valueStops, true);
      } else {
        const [min, max] = getGradientRange(plot, scaleKey, hardMin, hardMax, softMin, softMax);
        const range = max - min;
        const valueStops = thresholds.steps.map(
          (step) =>
            [
              min + range * (step.value / 100),
              colorManipulator.alpha(theme.visualization.getColorByName(step.color), opacity),
            ] as ValueStop
        );
        gradient = scaleGradient(plot, scaleKey, valueStops, true);
      }
    } else if (colorMode.getColors) {
      const colors = colorMode.getColors(theme);
      const [min, max] = getGradientRange(plot, scaleKey, hardMin, hardMax, softMin, softMax);
      const range = max - min;
      const valueStops = colors.map(
        (color, i) =>
          [
            min + range * (i / (colors.length - 1)),
            colorManipulator.alpha(theme.visualization.getColorByName(color), opacity),
          ] as ValueStop
      );
      gradient = scaleGradient(plot, scaleKey, valueStops, false);
    }

    return gradient;
  };
}
