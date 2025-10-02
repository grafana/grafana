import { FieldDisplay, GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { getValueAngleForValue } from './utils';

export interface RadialBarProps {
  gaugeId: string;
  center: number;
  fieldDisplay: FieldDisplay;
  size: number;
  startAngle: number;
  endAngle: number;
  color: string;
  barWidth: number;
  roundedBars?: boolean;
  spotlight?: boolean;
  margin: number;
  glow?: boolean;
}
export function RadialBar({
  center,
  fieldDisplay,
  gaugeId,
  startAngle,
  size,
  endAngle,
  color,
  barWidth,
  roundedBars,
  spotlight,
  margin,
  glow,
}: RadialBarProps) {
  const theme = useTheme2();
  const { range, angle } = getValueAngleForValue(fieldDisplay, startAngle, endAngle);

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
        roundedBars={true}
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
      {spotlight && angle > 8 && (
        <SpotlightSquareEffect
          radius={radius}
          center={center}
          angleRadian={endRadians}
          barWidth={barWidth}
          glow={glow}
          gaugeId={gaugeId}
          theme={theme}
          roundedBars={roundedBars}
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
  roundedBars?: boolean;
}

function SpotlightSquareEffect({
  radius,
  center,
  angleRadian,
  barWidth,
  glow,
  gaugeId,
  roundedBars,
}: SpotlightEffectProps) {
  let x1 = center + radius * Math.cos(angleRadian - 0.2);
  let y1 = center + radius * Math.sin(angleRadian - 0.2);
  let x2 = center + radius * Math.cos(angleRadian);
  let y2 = center + radius * Math.sin(angleRadian);

  const path = ['M', x1, y1, 'A', radius, radius, 0, 0, 1, x2, y2].join(' ');

  return (
    <path
      d={path}
      fill="none"
      strokeWidth={barWidth}
      stroke={`url(#spotlight-${gaugeId})`}
      strokeLinecap={roundedBars ? 'round' : 'butt'}
      filter={glow ? `url(#glow-${gaugeId})` : undefined}
    />
  );
}
