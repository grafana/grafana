import { FieldDisplay, Threshold, ThresholdsMode } from '@grafana/data';

import { RadialArcPath } from './RadialArcPath';
import { GradientStop, RadialGaugeDimensions, RadialShape } from './types';
import { getThresholdPercentageValue } from './utils';

interface ThresholdsBarProps {
  dimensions: RadialGaugeDimensions;
  angleRange: number;
  startAngle: number;
  endAngle: number;
  shape: RadialShape;
  fieldDisplay: FieldDisplay;
  roundedBars?: boolean;
  glowFilter?: string;
  thresholds: Threshold[];
  thresholdsMode?: ThresholdsMode;
  gradient?: GradientStop[];
}

export function ThresholdsBar({
  dimensions,
  fieldDisplay,
  startAngle,
  angleRange,
  roundedBars,
  glowFilter,
  thresholds,
  thresholdsMode = ThresholdsMode.Absolute,
  shape,
  gradient,
}: ThresholdsBarProps) {
  const thresholdDimensions = {
    ...dimensions,
    barWidth: dimensions.thresholdsBarWidth,
    radius: dimensions.thresholdsBarRadius,
  };

  let currentStart = startAngle;
  let paths: React.ReactNode[] = [];

  for (let i = 1; i < thresholds.length; i++) {
    const threshold = thresholds[i];
    const percentage = getThresholdPercentageValue(threshold, thresholdsMode, fieldDisplay);
    let valueDeg = percentage * angleRange;

    if (valueDeg > angleRange) {
      valueDeg = angleRange;
    } else if (valueDeg < 0) {
      valueDeg = 0;
    }

    const lengthDeg = valueDeg - currentStart + startAngle;
    const colorProps = gradient ? { gradient } : { color: threshold.color };

    paths.push(
      <g key={i} data-testid="radial-gauge-thresholds-bar">
        <RadialArcPath
          arcLengthDeg={lengthDeg}
          barEndcaps={shape === 'circle' && roundedBars}
          dimensions={thresholdDimensions}
          fieldDisplay={fieldDisplay}
          glowFilter={glowFilter}
          roundedBars={roundedBars}
          shape={shape}
          startAngle={currentStart}
          {...colorProps}
        />
      </g>
    );

    currentStart += lengthDeg;
  }

  return <g>{paths}</g>;
}
