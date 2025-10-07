import { DisplayProcessor, FieldDisplay } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { RadialGradientMode } from './RadialGauge';
import { GaugeDimensions, getValueAngleForValue } from './utils';

export interface RadialBarSegmentedProps {
  gaugeId: string;
  fieldDisplay: FieldDisplay;
  dimensions: GaugeDimensions;
  startAngle: number;
  endAngle: number;
  color: string;
  spotlight?: boolean;
  glow?: boolean;
  segmentCount: number;
  segmentSpacing: number;
  displayProcessor: DisplayProcessor;
  gradient: RadialGradientMode;
}
export function RadialBarSegmented({
  gaugeId,
  fieldDisplay,
  dimensions,
  startAngle,
  endAngle,
  color,
  glow,
  segmentCount,
  segmentSpacing,
  displayProcessor,
  gradient,
}: RadialBarSegmentedProps) {
  const segments: React.ReactNode[] = [];
  const theme = useTheme2();

  const { range } = getValueAngleForValue(fieldDisplay, startAngle, endAngle);
  const segmentCountAdjusted = getOptimalSegmentCount(dimensions, segmentSpacing, segmentCount, range);

  const min = fieldDisplay.field.min ?? 0;
  const max = fieldDisplay.field.max ?? 100;
  const value = fieldDisplay.display.numeric;

  const getColorForValue = (value: number) => {
    if (gradient === 'scheme') {
      return displayProcessor(value).color ?? 'green';
    }

    // For non scheme gradients the color is always the same
    return color;
  };

  for (let i = 0; i < segmentCountAdjusted; i++) {
    const angleValue = ((max - min) / segmentCountAdjusted) * i;
    const angleColor = getColorForValue(angleValue);
    const segmentAngle = startAngle + (range / segmentCountAdjusted) * i + 0.01;
    const segmentColor = angleValue > value ? theme.colors.action.hover : angleColor;

    segments.push(
      <RadialSegmentArcPath
        gaugeId={gaugeId}
        angle={segmentAngle}
        dimensions={dimensions}
        color={segmentColor}
        glow={glow}
        segmentSpacing={segmentSpacing}
        arcLengthDeg={range / segmentCountAdjusted}
      />
    );
  }

  return segments;
}

export interface RadialSegmentProps {
  gaugeId: string;
  angle: number;
  dimensions: GaugeDimensions;
  color: string;
  glow?: boolean;
  segmentSpacing: number;
  arcLengthDeg: number;
}

export function RadialSegmentArcPath({
  gaugeId,
  angle,
  dimensions,
  color,
  glow,
  segmentSpacing,
  arcLengthDeg,
}: RadialSegmentProps) {
  const { radius, centerX, centerY, barWidth } = dimensions;
  const spacingAngle = getAngleBetweenSegments(segmentSpacing, radius);

  const startRadians = (Math.PI * (angle - 90)) / 180;
  let endRadians = (Math.PI * (angle + arcLengthDeg - 90 - spacingAngle)) / 180;

  if (endRadians - startRadians < 0.02) {
    endRadians = startRadians + 0.01;
  }

  let x1 = centerX + radius * Math.cos(startRadians);
  let y1 = centerY + radius * Math.sin(startRadians);
  let x2 = centerX + radius * Math.cos(endRadians);
  let y2 = centerY + radius * Math.sin(endRadians);

  const largeArc = 0;

  const path = ['M', x1, y1, 'A', radius, radius, 0, largeArc, 1, x2, y2].join(' ');

  return (
    <path
      d={path}
      fill="none"
      fillOpacity="1"
      stroke={color}
      strokeOpacity="1"
      strokeLinecap={'butt'}
      strokeWidth={barWidth}
      strokeDasharray="0"
      filter={glow ? `url(#glow-${gaugeId})` : undefined}
    />
  );
}

function getAngleBetweenSegments(segmentSpacing: number, radius: number) {
  return segmentSpacing * 6 + 100 / (radius * 2);
}

function getOptimalSegmentCount(
  dimensions: GaugeDimensions,
  segmentSpacing: number,
  segmentCount: number,
  range: number
) {
  const angleBetweenSegments = getAngleBetweenSegments(segmentSpacing, dimensions.radius);

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
