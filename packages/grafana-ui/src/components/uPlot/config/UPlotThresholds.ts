import { colorManipulator, getColorForTheme, GrafanaThemeV2, ThresholdsConfig } from '@grafana/data';
import tinycolor from 'tinycolor2';
import { GraphThresholdsConfig, GraphTresholdsDisplayMode } from '../config';

export interface UPlotThresholdOptions {
  scaleKey: string;
  thresholds: ThresholdsConfig;
  config: GraphThresholdsConfig;
  theme: GrafanaThemeV2;
}

export function getThresholdsDrawHook(options: UPlotThresholdOptions) {
  return (u: uPlot) => {
    console.log('uplot', u.scales);

    const ctx = u.ctx;
    const { scaleKey, thresholds, theme, config } = options;
    const { min: xMin, max: xMax } = u.scales.x;
    const { min: yMin } = u.scales[scaleKey];

    if (xMin === undefined || xMax === undefined) {
      return;
    }

    switch (config.mode) {
      case GraphTresholdsDisplayMode.Line:
        for (let idx = 0; idx < thresholds.steps.length; idx++) {
          const step = thresholds.steps[idx];

          if (step.value === -Infinity) {
            continue;
          }

          let x0 = u.valToPos(xMin, 'x', true);
          let y0 = u.valToPos(step.value, scaleKey, true);
          let x1 = u.valToPos(xMax, 'x', true);
          let y1 = u.valToPos(step.value, scaleKey, true);

          ctx.beginPath();
          ctx.lineWidth = 2;
          ctx.strokeStyle = colorManipulator.alpha(getColorForTheme(step.color, theme.v1), 0.3);
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.closePath();
        }
        break;
      case GraphTresholdsDisplayMode.Area:
        for (let idx = 0; idx + 1 < thresholds.steps.length; idx++) {
          const step = thresholds.steps[idx];
          const nextStep = thresholds.steps[idx + 1];
          let color = tinycolor(getColorForTheme(step.color, theme.v1));

          // Ignore fully transparent colors
          const alpha = color.getAlpha();
          if (alpha === 0) {
            continue;
          }

          /// if no alpha set automatic alpha
          if (alpha === 1) {
            color = color.setAlpha(0.15);
          }

          let value = step.value === -Infinity ? yMin : step.value;

          let x0 = u.valToPos(xMin, 'x', true);
          let y0 = u.valToPos(value ?? 0, scaleKey, true);
          let x1 = u.valToPos(xMax, 'x', true);
          let y1 = u.valToPos(nextStep.value, scaleKey, true);

          ctx.save();
          ctx.fillStyle = color.toString();
          ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
          ctx.restore();
        }
    }
  };
}
