import { DisplayProcessor, FieldDisplay, Threshold } from '@grafana/data';

import { RadialArcPath } from './RadialArcPath';
import { RadialGradientMode, RadialShape } from './RadialGauge';
import { GaugeDimensions } from './utils';

export interface Props {
  dimensions: GaugeDimensions;
  angleRange: number;
  startAngle: number;
  endAngle: number;
  shape: RadialShape;
  fieldDisplay: FieldDisplay;
  roundedBars?: boolean;
  glowFilter?: string;
  thresholds: Threshold[];
  gradientMode: RadialGradientMode;
  displayProcessor: DisplayProcessor;
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
  displayProcessor,
}: Props) {
  const fieldConfig = fieldDisplay.field;
  const min = fieldConfig.min ?? 0;
  const max = fieldConfig.max ?? 100;

  const thresholdDimensions = {
    ...dimensions,
    barWidth: dimensions.thresholdsBarWidth,
    radius: dimensions.thresholdsBarRadius,
  };

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

    let lengthDeg = valueDeg - currentStart + startAngle;

    paths.push(
      <RadialArcPath
        key={i}
        startAngle={currentStart}
        arcLengthDeg={lengthDeg}
        color={gradientMode === 'none' ? threshold.color : undefined}
        shape={shape}
        dimensions={thresholdDimensions}
        roundedBars={roundedBars}
        glowFilter={glowFilter}
        gradientMode={gradientMode}
        displayProcessor={displayProcessor}
        fieldDisplay={fieldDisplay}
      />
    );

    currentStart += lengthDeg;
  }

  return <g>{paths}</g>;
}
