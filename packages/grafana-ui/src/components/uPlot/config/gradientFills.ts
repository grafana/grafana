import { FieldColorMode, FieldColorModeId, GrafanaTheme2, ThresholdsConfig } from '@grafana/data';
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

    const ctx = getCanvasContext();
    const gradient = ctx.createLinearGradient(0, plot.bbox.top, 0, plot.bbox.top + plot.bbox.height);
    const range = plot.bbox.height;
    const series = plot.series[seriesIdx];
    const scale = plot.scales[series.scale!];

    const addColorStop = (value: number, color: string) => {
      const pos = plot.valToPos(value, series.scale!, true);
      // when above range we get negative values here
      if (pos < 0) {
        return;
      }

      const percent = Math.max(pos / range, 0);
      const realColor = tinycolor(theme.visualization.getColorByName(color)).setAlpha(opacity).toString();
      const colorStopPos = Math.min(percent, 1);
      console.log(`addColorStop(value = ${value}, xPos=${pos})`);
      gradient.addColorStop(colorStopPos, realColor);
    };

    if (colorMode.id === FieldColorModeId.Thresholds) {
      // TODO Add support for percentage based thresholds
      for (let idx = 0; idx < thresholds.steps.length; idx++) {
        const step = thresholds.steps[idx];
        const value = step.value === -Infinity ? 0 : step.value;
        addColorStop(value, step.color);

        // to make the gradient discrete
        if (thresholds.steps.length > idx + 1) {
          addColorStop(thresholds.steps[idx + 1].value - 0.0000001, step.color);
        }
      }
    } else if (colorMode.getColors) {
      const colors = colorMode.getColors(theme);
      const min = scale.min ?? 0;
      const max = scale.max ?? 100;
      const stepValue = (max - min) / colors.length;

      for (let idx = 0; idx < colors.length; idx++) {
        addColorStop(idx * stepValue, colors[idx]);
      }
    }

    return gradient;
  };
}
