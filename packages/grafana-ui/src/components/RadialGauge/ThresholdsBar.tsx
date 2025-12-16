import { FieldDisplay, Threshold } from '@grafana/data';

import { RadialArcPath } from './RadialArcPath';
import { RadialGaugeDimensions, RadialGradientMode, RadialShape } from './types';
import { getFieldConfigMinMax } from './utils';

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
  gradientMode: RadialGradientMode;
}

export function ThresholdsBar({
  dimensions,
  fieldDisplay,
  startAngle,
  angleRange,
  roundedBars,
  glowFilter,
  thresholds,
  shape,
  gradientMode,
}: ThresholdsBarProps) {
  const thresholdDimensions = {
    ...dimensions,
    barWidth: dimensions.thresholdsBarWidth,
    radius: dimensions.thresholdsBarRadius,
  };

  const [min, max] = getFieldConfigMinMax(fieldDisplay);

  let currentStart = startAngle;
  let paths: React.ReactNode[] = [];

  for (let i = 1; i < thresholds.length; i++) {
    const threshold = thresholds[i];
    let valueDeg = ((threshold.value - min) / (max - min)) * angleRange;

    if (valueDeg > angleRange) {
      valueDeg = angleRange;
    } else if (valueDeg < 0) {
      valueDeg = 0;
    }

    const lengthDeg = valueDeg - currentStart + startAngle;
    const color = gradientMode === 'none' ? threshold.color : undefined;

    paths.push(
      <RadialArcPath
        key={i}
        arcLengthDeg={lengthDeg}
        color={color}
        dimensions={thresholdDimensions}
        fieldDisplay={fieldDisplay}
        glowFilter={glowFilter}
        gradientMode={gradientMode}
        roundedBars={roundedBars}
        shape={shape}
        startAngle={currentStart}
      />
    );

    currentStart += lengthDeg;
  }

  return <g>{paths}</g>;
}
