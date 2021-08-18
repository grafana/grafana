import { GrafanaTheme2, ThresholdsConfig, ThresholdsMode } from '@grafana/data';
import tinycolor from 'tinycolor2';
import { GraphThresholdsStyleConfig, GraphTresholdsStyleMode } from '../config';
import { getDataRange, GradientDirection, scaleGradient } from './gradientFills';

export interface UPlotThresholdOptions {
  scaleKey: string;
  thresholds: ThresholdsConfig;
  config: GraphThresholdsStyleConfig;
  theme: GrafanaTheme2;
}

export function getThresholdsDrawHook(options: UPlotThresholdOptions) {
  return (u: uPlot) => {
    const ctx = u.ctx;
    const { scaleKey, thresholds, theme, config } = options;
    const { min: xMin, max: xMax } = u.scales.x;
    const { min: yMin, max: yMax } = u.scales[scaleKey];

    if (xMin === undefined || xMax === undefined || yMin === undefined || yMax === undefined) {
      return;
    }

    let { steps, mode } = thresholds;

    if (mode === ThresholdsMode.Percentage) {
      let [min, max] = getDataRange(u, scaleKey);
      let range = max - min;

      steps = steps.map((step) => ({
        ...step,
        value: min + range * (step.value / 100),
      }));
    }

    function addLines() {
      // Thresholds below a transparent threshold is treated like "less than", and line drawn previous threshold
      let transparentIndex = 0;

      for (let idx = 0; idx < steps.length; idx++) {
        const step = steps[idx];
        if (step.color === 'transparent') {
          transparentIndex = idx;
          break;
        }
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

        let x0 = Math.round(u.valToPos(xMin!, 'x', true));
        let y0 = Math.round(u.valToPos(step.value, scaleKey, true));
        let x1 = Math.round(u.valToPos(xMax!, 'x', true));
        let y1 = Math.round(u.valToPos(step.value, scaleKey, true));

        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color.toString();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.closePath();
      }
    }

    function addAreas() {
      let grd = scaleGradient(
        u,
        u.series[1].scale!,
        GradientDirection.Up,
        steps.map((step) => {
          let color = tinycolor(theme.visualization.getColorByName(step.color));

          if (color.getAlpha() === 1) {
            color.setAlpha(0.15);
          }

          return [step.value, color.toString()];
        }),
        true
      );

      ctx.save();
      ctx.fillStyle = grd;
      ctx.fillRect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
      ctx.restore();
    }

    switch (config.mode) {
      case GraphTresholdsStyleMode.Line:
        addLines();
        break;
      case GraphTresholdsStyleMode.Area:
        addAreas();
        break;
      case GraphTresholdsStyleMode.LineAndArea:
        addLines();
        addAreas();
    }
  };
}
