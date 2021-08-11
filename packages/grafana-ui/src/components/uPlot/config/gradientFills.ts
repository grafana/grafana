import {
  colorManipulator,
  FieldColorMode,
  FieldColorModeId,
  GrafanaTheme2,
  ThresholdsConfig,
  ThresholdsMode,
} from '@grafana/data';
import tinycolor from 'tinycolor2';
import uPlot from 'uplot';
import { getCanvasContext } from '../../../utils/measureText';

export function getOpacityGradientFn(
  color: string,
  opacity: number
): (self: uPlot, seriesIdx: number) => CanvasGradient {
  return (plot: uPlot, seriesIdx: number) => {
    const ctx = getCanvasContext();
    const gradient = ctx.createLinearGradient(0, plot.bbox.top, 0, plot.bbox.top + plot.bbox.height);

    gradient.addColorStop(0, tinycolor(color).setAlpha(opacity).toRgbString());
    gradient.addColorStop(1, tinycolor(color).setAlpha(0).toRgbString());

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
    const gradient = ctx.createLinearGradient(0, plot.bbox.top, 0, plot.bbox.top + plot.bbox.height);
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

enum GradientDirection {
  'Right' = 0,
  'Up' = 1,
}

type ValueStop = [value: number, color: string];

type ScaleValueStops = ValueStop[];

function scaleGradient(
  u: uPlot,
  scaleKey: string,
  dir: GradientDirection,
  scaleStops: ScaleValueStops,
  discrete = false
) {
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

  let minStopPos = u.valToPos(minStopVal, scaleKey, true);
  let maxStopPos = u.valToPos(maxStopVal, scaleKey, true);

  let range = maxStopPos - minStopPos;

  let x0, y0, x1, y1;

  if (dir === GradientDirection.Up) {
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

    let stopPos = i === minStopIdx ? minStopPos : i === maxStopIdx ? maxStopPos : u.valToPos(s[0], scaleKey, true);
    let pct = (stopPos - minStopPos) / range;

    if (discrete && i > minStopIdx!) {
      grd.addColorStop(pct, prevColor!);
    }

    grd.addColorStop(pct, (prevColor = s[1]));
  }

  return grd;
}

/**
 * Experimental & quick and dirty test
 * Not being used
 */
export function getScaleGradientFn(
  opacity: number,
  theme: GrafanaTheme2,
  colorMode?: FieldColorMode,
  thresholds?: ThresholdsConfig
): (self: uPlot, seriesIdx: number) => CanvasGradient | string {
  if (!colorMode) {
    throw Error('Missing colorMode required for color scheme gradients');
  }

  if (!thresholds) {
    throw Error('Missing thresholds required for color scheme gradients');
  }

  return (plot: uPlot, seriesIdx: number) => {
    // A uplot bug (I think) where this is called before there is bbox
    // Color used for cursor highlight, not sure what to do here as this is called before we have bbox
    // and only once so same color is used for all points
    if (plot.bbox.top == null) {
      return theme.colors.text.primary;
    }

    let s = plot.series[seriesIdx];
    let sc = plot.scales[s.scale!];

    let gradient: CanvasGradient | string = '';

    if (colorMode.id === FieldColorModeId.Thresholds) {
      if (thresholds.mode === ThresholdsMode.Absolute) {
        let valueStops = thresholds.steps.map(
          (step) =>
            [step.value, colorManipulator.alpha(theme.visualization.getColorByName(step.color), opacity)] as ValueStop
        );
        gradient = scaleGradient(plot, s.scale!, GradientDirection.Up, valueStops, true);
      } else {
        let min = Infinity;
        let max = -Infinity;

        // get in-view y range for this scale
        plot.series.forEach((ser) => {
          if (ser.show && ser.scale === s.scale) {
            min = Math.min(min, ser.min!);
            max = Math.max(max, ser.max!);
          }
        });

        let range = max - min;

        if (range === 0) {
          range = sc.max! - sc.min!;
          min = sc.min!;
        }

        let valueStops = thresholds.steps.map(
          (step) =>
            [
              min + range * step.value,
              colorManipulator.alpha(theme.visualization.getColorByName(step.color), opacity),
            ] as ValueStop
        );
        gradient = scaleGradient(plot, s.scale!, GradientDirection.Up, valueStops, true);
      }
    } else if (colorMode.getColors) {
      const ctx = getCanvasContext();
      gradient = ctx.createLinearGradient(0, plot.bbox.top, 0, plot.bbox.top + plot.bbox.height);
      const canvasHeight = plot.bbox.height;
      const canvasTop = plot.bbox.top;
      const series = plot.series[seriesIdx];
      const scale = plot.scales[series.scale!];
      const scaleMin = scale.min ?? 0;
      const scaleMax = scale.max ?? 100;

      const addColorStop = (value: number, color: string) => {
        const pos = plot.valToPos(value, series.scale!, true) - canvasTop;
        // when above range we get negative values here
        if (pos < 0) {
          return;
        }

        const percent = Math.max(pos / canvasHeight, 0);
        const realColor = tinycolor(theme.visualization.getColorByName(color)).setAlpha(opacity).toString();
        const colorStopPos = Math.min(percent, 1);

        gradient.addColorStop(colorStopPos, realColor);
      };

      const colors = colorMode.getColors(theme);
      const stepValue = (scaleMax - scaleMin) / colors.length;

      for (let idx = 0; idx < colors.length; idx++) {
        addColorStop(scaleMin + stepValue * idx, colors[idx]);
      }
    }

    return gradient;
  };
}
