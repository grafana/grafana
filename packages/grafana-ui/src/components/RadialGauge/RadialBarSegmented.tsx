import { DisplayProcessor, FALLBACK_COLOR, FieldDisplay } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { RadialArcPath } from './RadialArcPath';
import { RadialGradientMode, RadialShape } from './RadialGauge';
import { GaugeDimensions } from './utils';

export interface RadialBarSegmentedProps {
  fieldDisplay: FieldDisplay;
  displayProcessor: DisplayProcessor;
  dimensions: GaugeDimensions;
  angleRange: number;
  startAngle: number;
  glowFilter?: string;
  segmentCount: number;
  segmentSpacing: number;
  shape: RadialShape;
  gradientMode: RadialGradientMode;
}
export function RadialBarSegmented({
  fieldDisplay,
  displayProcessor,
  dimensions,
  startAngle,
  angleRange,
  glowFilter,
  segmentCount,
  segmentSpacing,
  shape,
  gradientMode,
}: RadialBarSegmentedProps) {
  const segments: React.ReactNode[] = [];
  const theme = useTheme2();

  const segmentCountAdjusted = getOptimalSegmentCount(dimensions, segmentSpacing, segmentCount, angleRange);
  const min = fieldDisplay.field.min ?? 0;
  const max = fieldDisplay.field.max ?? 100;
  const value = fieldDisplay.display.numeric;
  const angleBetweenSegments = getAngleBetweenSegments(segmentSpacing, segmentCount, angleRange);
  const segmentArcLengthDeg = angleRange / segmentCountAdjusted - angleBetweenSegments;

  for (let i = 0; i < segmentCountAdjusted; i++) {
    const angleValue = min + ((max - min) / segmentCountAdjusted) * i;
    const segmentAngle = startAngle + (angleRange / segmentCountAdjusted) * i + 0.01;
    let segmentColor: string | undefined;
    if (angleValue >= value) {
      segmentColor = theme.colors.action.hover;
    } else if (gradientMode === 'none') {
      segmentColor = displayProcessor(angleValue).color ?? FALLBACK_COLOR;
    }

    segments.push(
      <RadialArcPath
        key={i}
        startAngle={segmentAngle}
        dimensions={dimensions}
        color={segmentColor}
        shape={shape}
        glowFilter={glowFilter}
        arcLengthDeg={segmentArcLengthDeg}
        gradientMode={gradientMode}
        fieldDisplay={fieldDisplay}
        displayProcessor={displayProcessor}
      />
    );
  }

  return <g>{segments}</g>;
}

export function getAngleBetweenSegments(segmentSpacing: number, segmentCount: number, range: number) {
  // Max spacing is 8 degrees between segments
  // Changing this constant could be considered a breaking change
  const maxAngleBetweenSegments = Math.max(range / 1.5 / segmentCount, 2);
  return segmentSpacing * maxAngleBetweenSegments;
}

function getOptimalSegmentCount(
  dimensions: GaugeDimensions,
  segmentSpacing: number,
  segmentCount: number,
  range: number
) {
  const angleBetweenSegments = getAngleBetweenSegments(segmentSpacing, segmentCount, range);

  const innerRadius = dimensions.radius - dimensions.barWidth / 2;
  const circumference = Math.PI * innerRadius * 2 * (range / 360);
  const maxSegments = Math.floor(circumference / (angleBetweenSegments + 3));

  return Math.min(maxSegments, segmentCount);
}
