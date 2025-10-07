import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { GaugeDimensions } from './utils';

export interface RadialBarProps {
  dimensions: GaugeDimensions;
  angleRange: number;
  angle: number;
  startAngle: number;
  color: string;
  roundedBars?: boolean;
  spotlightStroke: string;
  glowFilter?: string;
}
export function RadialBar({
  dimensions,
  angleRange,
  angle,
  startAngle,
  color,
  roundedBars,
  spotlightStroke,
  glowFilter,
}: RadialBarProps) {
  const theme = useTheme2();

  const trackStart = startAngle + angle;
  const trackLength = angleRange - angle;

  return (
    <g>
      {/** Track */}
      <RadialArcPath
        angle={trackLength}
        dimensions={dimensions}
        startAngle={trackStart}
        color={theme.colors.action.hover}
        roundedBars={roundedBars}
        theme={theme}
      />
      {/** The colored bar */}
      <RadialArcPath
        angle={angle}
        dimensions={dimensions}
        startAngle={startAngle}
        color={color}
        roundedBars={roundedBars}
        spotlightStroke={spotlightStroke}
        glowFilter={glowFilter}
        theme={theme}
      />
    </g>
  );
}

export interface RadialArcPathProps {
  angle: number;
  startAngle: number;
  dimensions: GaugeDimensions;
  color: string;
  roundedBars?: boolean;
  spotlightStroke?: string;
  glowFilter?: string;
  theme: GrafanaTheme2;
}

export function RadialArcPath({
  startAngle,
  dimensions,
  angle,
  color,
  roundedBars,
  spotlightStroke,
  glowFilter,
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
        filter={glowFilter}
      />
      {spotlightStroke && angle > 8 && (
        <SpotlightSquareEffect
          radius={radius}
          centerX={centerX}
          centerY={centerY}
          angleRadian={endRadians}
          barWidth={barWidth}
          glowFilter={glowFilter}
          spotlightStroke={spotlightStroke}
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
  glowFilter?: string;
  spotlightStroke: string;
  theme: GrafanaTheme2;
  roundedBars?: boolean;
}

function SpotlightSquareEffect({
  radius,
  centerX,
  centerY,
  angleRadian,
  barWidth,
  glowFilter,
  spotlightStroke,
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
      stroke={spotlightStroke}
      strokeLinecap={roundedBars ? 'round' : 'butt'}
      filter={glowFilter}
    />
  );
}
