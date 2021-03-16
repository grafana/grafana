import { FieldColorMode, getColorForTheme, GrafanaTheme, ThresholdsConfig } from '@grafana/data';
import tinycolor from 'tinycolor2';
import uPlot from 'uplot';
import darkTheme from '../../../themes/dark';
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
  theme: GrafanaTheme
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
      return tinycolor(getColorForTheme(color, darkTheme)).setAlpha(opacity).toString();
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
