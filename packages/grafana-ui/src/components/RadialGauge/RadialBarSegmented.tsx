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
  clockwise,
  spotlight,
  margin,
  glow,
  segmentCount,
}: RadialBarSegmentedProps) {
  const segments: React.ReactNode[] = [];
  const theme = useTheme2();

  const range = (360 % (startAngle === 0 ? 1 : startAngle)) + endAngle;
  let angle = ((value - min) / (max - min)) * range;

  if (angle > range) {
    angle = range;
  }

  for (let i = 0; i < segmentCount; i++) {
    const segmentAngle = (360 / segmentCount) * i + 0.01;
    const segmentColor = segmentAngle > angle ? theme.colors.action.hover : color;

    segments.push(
      <RadialSegmentPath
        gaugeId={gaugeId}
        angle={segmentAngle}
        center={center}
        size={size}
        startAngle={startAngle}
        color={segmentColor}
        barWidth={barWidth}
        clockwise={clockwise}
        spotlight={spotlight}
        glow={glow}
        margin={margin}
      />
    );
  }

  return segments;
}

export interface RadialSegmentPathProps {
  gaugeId: string;
  angle: number;
  startAngle: number;
  center: number;
  size: number;
  color: string;
  barWidth: number;
  roundedBars?: boolean;
  clockwise?: boolean;
  spotlight?: boolean;
  glow?: boolean;
  margin: number;
}

export function RadialSegmentPath({
  gaugeId,
  startAngle,
  center,
  angle,
  size,
  color,
  barWidth,
  roundedBars,
  clockwise,
  spotlight,
  glow,
  margin,
}: RadialSegmentPathProps) {
  const arcSize = size - barWidth;
  const radius = arcSize / 2 - margin;

  let angleRad = (Math.PI * (angle - 90)) / 180;
  let lineLength = radius * 0.8;

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
        strokeWidth={4}
        strokeDasharray="0"
        filter={glow ? `url(#glow-${gaugeId})` : undefined}
      />
    </>
  );
}
