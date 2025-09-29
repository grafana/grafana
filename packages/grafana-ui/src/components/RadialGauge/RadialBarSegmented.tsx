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
}: RadialBarSegmentedProps) {
  const segments: React.ReactNode[] = [];
  const theme = useTheme2();

  const segmentCountAdjusted = getOptimalSegmentCount(size, segmentCount, segmentWidth, margin);
  const range = (360 % (startAngle === 0 ? 1 : startAngle)) + endAngle;
  let angle = ((value - min) / (max - min)) * range;

  if (angle > range) {
    angle = range;
  }

  for (let i = 0; i < segmentCountAdjusted; i++) {
    const segmentAngle = (360 / segmentCountAdjusted) * i + 0.01;
    const segmentColor = segmentAngle > angle ? theme.colors.action.hover : color;

    segments.push(
      <RadialSegmentPath
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
      />
    );
  }

  return segments;
}

export interface RadialSegmentPathProps {
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
}

export function RadialSegmentPath({
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
}: RadialSegmentPathProps) {
  const arcSize = size - barWidth;
  const radius = arcSize / 2 - margin;

  let angleRad = (Math.PI * (angle - 90)) / 180;
  let lineLength = radius - barWidth;

  let x1 = center + radius * Math.cos(angleRad);
  let y1 = center + radius * Math.sin(angleRad);
  let x2 = center + lineLength * Math.cos(angleRad);
  let y2 = center + lineLength * Math.sin(angleRad);

  return (
    <>
      <line
        //d={path}
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
    </>
  );
}

function getOptimalSegmentCount(size: number, segmentCount: number, segmentWidth: number, margin: number) {
  const minSpaceBetweenSegments = Math.min((segmentCount / 100) * 30, 5);

  const innerRadius = (size - segmentWidth) / 2 - margin;
  const circumference = Math.PI * innerRadius * 2;
  const maxSegments = Math.floor(circumference / (segmentWidth + minSpaceBetweenSegments));

  return Math.min(maxSegments, segmentCount);
}
