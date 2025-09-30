import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

export interface RadialBarProps {
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
  roundedBars?: boolean;
  clockwise: boolean;
  spotlight?: boolean;
  margin: number;
  glow?: boolean;
}
export function RadialBar({
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
  roundedBars,
  clockwise,
  spotlight,
  margin,
  glow,
}: RadialBarProps) {
  const theme = useTheme2();
  const range = (360 % (startAngle === 0 ? 1 : startAngle)) + endAngle;
  let angle = ((value - min) / (max - min)) * range;

  if (angle > range) {
    angle = range;
  }

  if (!clockwise) {
    startAngle = endAngle - angle;
  }

  const trackStart = startAngle + angle;
  const trackLength = range - angle;

  return (
    <>
      {/** Track */}
      <RadialArcPath
        gaugeId={gaugeId}
        angle={trackLength}
        center={center}
        size={size}
        startAngle={trackStart}
        color={theme.colors.action.hover}
        barWidth={barWidth}
        roundedBars={false}
        clockwise={clockwise}
        margin={margin}
        theme={theme}
      />
      {/** The colored bar */}
      <RadialArcPath
        gaugeId={gaugeId}
        angle={angle}
        center={center}
        size={size}
        startAngle={startAngle}
        color={color}
        barWidth={barWidth}
        roundedBars={roundedBars}
        clockwise={clockwise}
        spotlight={spotlight}
        glow={glow}
        margin={margin}
        theme={theme}
      />
    </>
  );
}

export interface RadialArcPathProps {
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
  theme: GrafanaTheme2;
}

export function RadialArcPath({
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
  theme,
}: RadialArcPathProps) {
  const arcSize = size - barWidth;
  const radius = arcSize / 2 - margin;

  let startDeg = startAngle;
  let endDeg = angle + startAngle;

  if (endDeg - startDeg === 360) {
    startDeg += 0.01;
  }

  let startRadians = (Math.PI * (startDeg - 90)) / 180;
  let endRadians = (Math.PI * (endDeg - 90)) / 180;

  let x1 = center + radius * Math.cos(startRadians);
  let y1 = center + radius * Math.sin(startRadians);
  let x2 = center + radius * Math.cos(endRadians);
  let y2 = center + radius * Math.sin(endRadians);

  let largeArc = angle > 180 ? 1 : 0;

  const path = ['M', x1, y1, 'A', radius, radius, 0, largeArc, 1, x2, y2].join(' ');

  return (
    <>
      <path
        d={path}
        fill="none"
        fillOpacity="1"
        stroke={color}
        strokeOpacity="1"
        strokeLinecap={roundedBars ? 'round' : 'butt'}
        strokeWidth={barWidth}
        strokeDasharray="0"
        filter={glow ? `url(#glow-${gaugeId})` : undefined}
      />
      {spotlight && angle > 8 && roundedBars && (
        <circle
          r={barWidth * 0.9}
          cx={clockwise ? x2 : x1}
          cy={clockwise ? y2 : y1}
          fill={`url(#spotlight-${gaugeId})`}
        />
      )}
      {spotlight && angle > 8 && !roundedBars && (
        <SpotlightEffect
          radius={radius}
          center={center}
          angleRadian={endRadians}
          barWidth={barWidth}
          glow={glow}
          gaugeId={gaugeId}
          theme={theme}
        />
      )}
    </>
  );
}

interface SpotlightEffectProps {
  radius: number;
  center: number;
  angleRadian: number;
  barWidth: number;
  glow?: boolean;
  gaugeId: string;
  theme: GrafanaTheme2;
}

function SpotlightEffect({ radius, center, angleRadian, barWidth, glow, gaugeId, theme }: SpotlightEffectProps) {
  let x1 = center + (radius - barWidth / 2) * Math.cos(angleRadian);
  let y1 = center + (radius - barWidth / 2) * Math.sin(angleRadian);
  let x2 = center + (radius + barWidth / 2) * Math.cos(angleRadian);
  let y2 = center + (radius + barWidth / 2) * Math.sin(angleRadian);

  const path = ['M', x1, y1, 'L', x2, y2].join(' ');

  return (
    <path
      d={path}
      fill="none"
      strokeWidth={2}
      stroke={theme.colors.text.maxContrast}
      filter={glow ? `url(#glow-${gaugeId})` : undefined}
      strokeDasharray={'0'}
    />
  );
}
