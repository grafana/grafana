import { DisplayProcessor } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

export interface RadialBarSegmentedProps {
  gaugeId: string;
  value: number;
  center: number;
  min: number;
  max: number;
  size: number;
  startAngle: number;
  endAngle: number;
  color: string;
  barWidth: number;
  clockwise: boolean;
  spotlight?: boolean;
  margin: number;
  glow?: boolean;
  segmentCount: number;
  segmentWidth: number;
  displayProcessor: DisplayProcessor;
}
export function RadialBarSegmented({
  center,
  gaugeId,
  value,
  min,
  max,
  startAngle,
  size,
  endAngle,
  color,
  barWidth,
  margin,
  glow,
  segmentCount,
  segmentWidth,
  displayProcessor,
}: RadialBarSegmentedProps) {
  const segments: React.ReactNode[] = [];
  const theme = useTheme2();

  const segmentCountAdjusted = getOptimalSegmentCount(size, segmentCount, barWidth, segmentWidth, margin);
  const range = (360 % (startAngle === 0 ? 1 : startAngle)) + endAngle;
  let angle = ((value - min) / (max - min)) * range;

  if (angle > range) {
    angle = range;
  }

  for (let i = 0; i < segmentCountAdjusted; i++) {
    const angleValue = ((max - min) / segmentCountAdjusted) * i;
    const angleColor = displayProcessor(angleValue);
    const segmentAngle = (360 / segmentCountAdjusted) * i + 0.01;
    const segmentColor = segmentAngle > angle ? theme.colors.action.hover : (angleColor.color ?? 'gray');

    segments.push(
      <RadialSegmentArcPath
        gaugeId={gaugeId}
        angle={segmentAngle}
        center={center}
        size={size}
        color={segmentColor}
        barWidth={barWidth}
        glow={glow}
        margin={margin}
        segmentWidth={segmentWidth}
        roundedBars={size > 100}
        arcLengthDeg={360 / segmentCountAdjusted}
      />
    );
  }

  return segments;
}

export interface RadialSegmentProps {
  gaugeId: string;
  angle: number;
  center: number;
  size: number;
  color: string;
  barWidth: number;
  roundedBars?: boolean;
  glow?: boolean;
  margin: number;
  segmentWidth: number;
  arcLengthDeg: number;
}

export function RadialSegmentLine({
  gaugeId,
  center,
  angle,
  size,
  color,
  barWidth,
  roundedBars,
  glow,
  margin,
  segmentWidth,
}: RadialSegmentProps) {
  const arcSize = size - barWidth;
  const radius = arcSize / 2 - margin;

  const angleRad = (Math.PI * (angle - 90)) / 180;
  const lineLength = radius - barWidth;

  const x1 = center + radius * Math.cos(angleRad);
  const y1 = center + radius * Math.sin(angleRad);
  const x2 = center + lineLength * Math.cos(angleRad);
  const y2 = center + lineLength * Math.sin(angleRad);

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      fill="none"
      fillOpacity="0.85"
      stroke={color}
      strokeOpacity="1"
      strokeLinecap={roundedBars ? 'round' : 'butt'}
      strokeWidth={segmentWidth}
      strokeDasharray="0"
      filter={glow ? `url(#glow-${gaugeId})` : undefined}
    />
  );
}

export function RadialSegmentArcPath({
  gaugeId,
  center,
  angle,
  size,
  color,
  barWidth,
  roundedBars,
  glow,
  margin,
  segmentWidth,
  arcLengthDeg,
}: RadialSegmentProps) {
  const arcSize = size - barWidth;
  const radius = arcSize / 2 - margin;
  const spacingAngle = getAngleBetweenSegments(segmentWidth, size);

  const startRadians = (Math.PI * (angle - 90)) / 180;
  const endRadians = (Math.PI * (angle + arcLengthDeg - 90 - spacingAngle)) / 180;

  let x1 = center + radius * Math.cos(startRadians);
  let y1 = center + radius * Math.sin(startRadians);
  let x2 = center + radius * Math.cos(endRadians);
  let y2 = center + radius * Math.sin(endRadians);

  //let largeArc = angle > 180 ? 1 : 0;
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

function getAngleBetweenSegments(segmentSpacing: number, size: number) {
  return segmentSpacing * 6 + 100 / size;
}

function getOptimalSegmentCount(
  size: number,
  segmentCount: number,
  barWidth: number,
  segmentSpacing: number,
  margin: number
) {
  const angleBetweenSegments = getAngleBetweenSegments(segmentSpacing, size);

  const innerRadius = (size - barWidth) / 2 - margin;
  const circumference = Math.PI * innerRadius * 2;
  const maxSegments = Math.floor(circumference / (angleBetweenSegments + 3));

  return Math.min(maxSegments, segmentCount);
}
