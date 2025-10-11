import { DisplayProcessor, FieldDisplay } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { RadialArcPath } from './RadialArcPath';
import { RadialGradientMode } from './RadialGauge';
import { GaugeDimensions } from './utils';

export interface RadialBarSegmentedProps {
  fieldDisplay: FieldDisplay;
  dimensions: GaugeDimensions;
  angleRange: number;
  startAngle: number;
  color: string;
  glowFilter?: string;
  segmentCount: number;
  segmentSpacing: number;
  displayProcessor: DisplayProcessor;
  gradient: RadialGradientMode;
}
export function RadialBarSegmented({
  fieldDisplay,
  dimensions,
  startAngle,
  angleRange,
  color,
  glowFilter,
  segmentCount,
  segmentSpacing,
  displayProcessor,
  gradient,
}: RadialBarSegmentedProps) {
  const segments: React.ReactNode[] = [];
  const theme = useTheme2();

  const segmentCountAdjusted = getOptimalSegmentCount(dimensions, segmentSpacing, segmentCount, angleRange);
  const min = fieldDisplay.field.min ?? 0;
  const max = fieldDisplay.field.max ?? 100;
  const value = fieldDisplay.display.numeric;
  const angleBetweenSegments = getAngleBetweenSegments(segmentSpacing);
  const segmentArcLengthDeg = angleRange / segmentCountAdjusted - angleBetweenSegments;

  const getColorForValue = (value: number) => {
    return displayProcessor(value).color ?? color;
  };

  for (let i = 0; i < segmentCountAdjusted; i++) {
    const angleValue = ((max - min) / segmentCountAdjusted) * i;
    const angleColor = getColorForValue(angleValue);
    const segmentAngle = startAngle + (angleRange / segmentCountAdjusted) * i + 0.01;
    const segmentColor = angleValue > value ? theme.colors.action.hover : angleColor;

    segments.push(
      <RadialArcPath
        key={i}
        startAngle={segmentAngle}
        dimensions={dimensions}
        color={segmentColor}
        glowFilter={glowFilter}
        arcLengthDeg={segmentArcLengthDeg}
      />
    );
  }

  return <g>{segments}</g>;
}

export function getAngleBetweenSegments(segmentSpacing: number) {
  // Max spacing is 8 degrees between segments
  // Changing this constant could be considered a breaking change
  const maxAngleBetweenSegments = 8;

  return segmentSpacing * maxAngleBetweenSegments;
}

function getOptimalSegmentCount(
  dimensions: GaugeDimensions,
  segmentSpacing: number,
  segmentCount: number,
  range: number
) {
  const angleBetweenSegments = getAngleBetweenSegments(segmentSpacing);

  const innerRadius = dimensions.radius - dimensions.barWidth / 2;
  const circumference = Math.PI * innerRadius * 2 * (range / 360);
  const maxSegments = Math.floor(circumference / (angleBetweenSegments + 3));

  return Math.min(maxSegments, segmentCount);
}

// export function RadialSegmentLine({
//   gaugeId,
//   center,
//   angle,
//   size,
//   color,
//   barWidth,
//   roundedBars,
//   glow,
//   margin,
//   segmentWidth,
// }: RadialSegmentProps) {
//   const arcSize = size - barWidth;
//   const radius = arcSize / 2 - margin;

//   const angleRad = (Math.PI * (angle - 90)) / 180;
//   const lineLength = radius - barWidth;

//   const x1 = center + radius * Math.cos(angleRad);
//   const y1 = center + radius * Math.sin(angleRad);
//   const x2 = center + lineLength * Math.cos(angleRad);
//   const y2 = center + lineLength * Math.sin(angleRad);

//   return (
//     <line
//       x1={x1}
//       y1={y1}
//       x2={x2}
//       y2={y2}
//       fill="none"
//       fillOpacity="0.85"
//       stroke={color}
//       strokeOpacity="1"
//       strokeLinecap={roundedBars ? 'round' : 'butt'}
//       strokeWidth={segmentWidth}
//       strokeDasharray="0"
//       filter={glow ? `url(#glow-${gaugeId})` : undefined}
//     />
//   );
// }
