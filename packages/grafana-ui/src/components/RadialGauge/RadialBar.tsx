import { FieldDisplay, GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { GaugeDimensions, getValueAngleForValue } from './utils';

export interface RadialBarProps {
  gaugeId: string;
  dimensions: GaugeDimensions;
  fieldDisplay: FieldDisplay;
  startAngle: number;
  endAngle: number;
  color: string;
  roundedBars?: boolean;
  spotlight?: boolean;
  glow?: boolean;
}
export function RadialBar({
  dimensions,
  fieldDisplay,
  gaugeId,
  startAngle,
  endAngle,
  color,
  roundedBars,
  spotlight,
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
        dimensions={dimensions}
        startAngle={trackStart}
        color={theme.colors.action.hover}
        roundedBars={roundedBars}
        theme={theme}
      />
      {/** The colored bar */}
      <RadialArcPath
        gaugeId={gaugeId}
        angle={angle}
        dimensions={dimensions}
        startAngle={startAngle}
        color={color}
        roundedBars={roundedBars}
        spotlight={spotlight}
        glow={glow}
        theme={theme}
      />
    </>
  );
}

export interface RadialArcPathProps {
  gaugeId: string;
  angle: number;
  startAngle: number;
  dimensions: GaugeDimensions;
  color: string;
  roundedBars?: boolean;
  spotlight?: boolean;
  glow?: boolean;
  theme: GrafanaTheme2;
}

export function RadialArcPath({
  gaugeId,
  startAngle,
  dimensions,
  angle,
  color,
  roundedBars,
  spotlight,
  glow,
  theme,
}: RadialArcPathProps) {
  let { radius, centerX, centerY, barWidth } = dimensions;
  let startDeg = startAngle;
  let endDeg = angle + startAngle;

  if (endDeg - startDeg === 360) {
    startDeg += 0.01;
  }

  let startRadians = (Math.PI * (startDeg - 90)) / 180;
  let endRadians = (Math.PI * (endDeg - 90)) / 180;

  let x1 = centerX + radius * Math.cos(startRadians);
  let y1 = centerY + radius * Math.sin(startRadians);
  let x2 = centerX + radius * Math.cos(endRadians);
  let y2 = centerY + radius * Math.sin(endRadians);

  let largeArc = endDeg - startDeg > 180 ? 1 : 0;

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
          centerX={centerX}
          centerY={centerY}
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
  centerX: number;
  centerY: number;
  angleRadian: number;
  barWidth: number;
  glow?: boolean;
  gaugeId: string;
  theme: GrafanaTheme2;
  roundedBars?: boolean;
}

function SpotlightSquareEffect({
  radius,
  centerX,
  centerY,
  angleRadian,
  barWidth,
  glow,
  gaugeId,
  roundedBars,
}: SpotlightEffectProps) {
  let x1 = centerX + radius * Math.cos(angleRadian - 0.2);
  let y1 = centerY + radius * Math.sin(angleRadian - 0.2);
  let x2 = centerX + radius * Math.cos(angleRadian);
  let y2 = centerY + radius * Math.sin(angleRadian);

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
