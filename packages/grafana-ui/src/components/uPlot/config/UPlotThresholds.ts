import tinycolor from 'tinycolor2';
import uPlot from 'uplot';

import { GrafanaTheme2, Threshold, ThresholdsConfig, ThresholdsMode } from '@grafana/data';
import { GraphThresholdsStyleConfig, GraphTresholdsStyleMode } from '@grafana/schema';

import { getGradientRange, scaleGradient } from './gradientFills';

export interface UPlotThresholdOptions {
  scaleKey: string;
  thresholds: ThresholdsConfig;
  config: GraphThresholdsStyleConfig;
  theme: GrafanaTheme2;
  hardMin?: number | null;
  hardMax?: number | null;
  softMin?: number | null;
  softMax?: number | null;
}

export function getThresholdsDrawHook(options: UPlotThresholdOptions) {
  const dashSegments =
    options.config.mode === GraphTresholdsStyleMode.Dashed ||
    options.config.mode === GraphTresholdsStyleMode.DashedAndArea
      ? [10, 10]
      : null;

  function addLines(u: uPlot, yScaleKey: string, steps: Threshold[], theme: GrafanaTheme2) {
    let ctx = u.ctx;

    // Thresholds below a transparent threshold is treated like "less than", and line drawn previous threshold
    let transparentIndex = 0;

    for (let idx = 0; idx < steps.length; idx++) {
      const step = steps[idx];
      if (step.color === 'transparent') {
        transparentIndex = idx;
        break;
      }
    }

    ctx.lineWidth = 2;

    if (dashSegments) {
      ctx.setLineDash(dashSegments);
    }

    // Ignore the base -Infinity threshold by always starting on index 1
    for (let idx = 1; idx < steps.length; idx++) {
      const step = steps[idx];
      let color: tinycolor.Instance;

      // if we are below a transparent index treat this a less then threshold, use previous thresholds color
      if (transparentIndex >= idx && idx > 0) {
        color = tinycolor(theme.visualization.getColorByName(steps[idx - 1].color));
      } else {
        color = tinycolor(theme.visualization.getColorByName(step.color));
      }

      // Unless alpha specififed set to default value
      if (color.getAlpha() === 1) {
        color.setAlpha(0.7);
      }

      let x0 = Math.round(u.bbox.left);
      let y0 = Math.round(u.valToPos(step.value, yScaleKey, true));
      let x1 = Math.round(u.bbox.left + u.bbox.width);
      let y1 = Math.round(u.valToPos(step.value, yScaleKey, true));

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);

      ctx.strokeStyle = color.toString();
      ctx.stroke();
    }
  }

  function addAreas(u: uPlot, yScaleKey: string, steps: Threshold[], theme: GrafanaTheme2) {
    let ctx = u.ctx;

    let grd = scaleGradient(
      u,
      yScaleKey,
      steps.map((step) => {
        let color = tinycolor(theme.visualization.getColorByName(step.color));

        if (color.getAlpha() === 1) {
          color.setAlpha(0.15);
        }

        return [step.value, color.toString()];
      }),
      true
    );

    ctx.fillStyle = grd;
    ctx.fillRect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
  }

  const { scaleKey, thresholds, theme, config, hardMin, hardMax, softMin, softMax } = options;

  return (u: uPlot) => {
    const ctx = u.ctx;
    const { min: xMin, max: xMax } = u.scales.x;
    const { min: yMin, max: yMax } = u.scales[scaleKey];

    if (xMin == null || xMax == null || yMin == null || yMax == null) {
      return;
    }

    let { steps, mode } = thresholds;

    if (mode === ThresholdsMode.Percentage) {
      let [min, max] = getGradientRange(u, scaleKey, hardMin, hardMax, softMin, softMax);
      let range = max - min;

      steps = steps.map((step) => ({
        ...step,
        value: min + range * (step.value / 100),
      }));
    }

    ctx.save();

    switch (config.mode) {
      case GraphTresholdsStyleMode.Line:
      case GraphTresholdsStyleMode.Dashed:
        addLines(u, scaleKey, steps, theme);
        break;
      case GraphTresholdsStyleMode.Area:
        addAreas(u, scaleKey, steps, theme);
        break;
      case GraphTresholdsStyleMode.LineAndArea:
      case GraphTresholdsStyleMode.DashedAndArea:
        addAreas(u, scaleKey, steps, theme);
        addLines(u, scaleKey, steps, theme);
    }

    ctx.restore();
  };
}
