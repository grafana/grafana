import { GrafanaTheme2, ThresholdsConfig, ThresholdsMode } from '@grafana/data';
import tinycolor from 'tinycolor2';
import { GraphThresholdsStyleConfig, GraphTresholdsStyleMode } from '../config';

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

    // a close copy of the version in ./gradientFills.ts
    if (mode === ThresholdsMode.Percentage) {
      let sc = u.scales[scaleKey];

      let min = Infinity;
      let max = -Infinity;

      // get in-view y range for this scale
      u.series.forEach((ser) => {
        if (ser.show && ser.scale === scaleKey) {
          min = Math.min(min, ser.min!);
          max = Math.max(max, ser.max!);
        }
      });

      let range = max - min;

      if (range === 0) {
        range = sc.max! - sc.min!;
        min = sc.min!;
      }

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
      for (let idx = 0; idx < steps.length; idx++) {
        const step = steps[idx];

        // skip thresholds that cannot be seen
        if (step.value > yMax!) {
          continue;
        }

        // if this is the last step make the next step the same color but +Infinity
        const nextStep =
          idx + 1 < steps.length
            ? steps[idx + 1]
            : {
                ...step,
                value: Infinity,
              };

        let color = tinycolor(theme.visualization.getColorByName(step.color));

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
        let nextValue = nextStep.value === Infinity || nextStep.value > yMax! ? yMax : nextStep.value;

        let x0 = Math.round(u.valToPos(xMin ?? 0, 'x', true));
        let y0 = Math.round(u.valToPos(value ?? 0, scaleKey, true));
        let x1 = Math.round(u.valToPos(xMax ?? 1, 'x', true));
        let y1 = Math.round(u.valToPos(nextValue ?? 1, scaleKey, true));

        ctx.save();
        ctx.fillStyle = color.toString();
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.restore();
      }
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
