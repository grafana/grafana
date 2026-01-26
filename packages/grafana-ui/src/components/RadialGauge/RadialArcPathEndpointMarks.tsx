import { FieldDisplay } from '@grafana/data';

import { getEndpointMarkerColors, getGuideDotColor } from './colors';
import { GradientStop, RadialGaugeDimensions } from './types';
import { toRad } from './utils';

interface RadialArcPathEndpointMarksPropsBase {
  arcLengthDeg: number;
  dimensions: RadialGaugeDimensions;
  fieldDisplay: FieldDisplay;
  endpointMarker: 'point' | 'glow';
  roundedBars?: boolean;
  startAngle: number;
  glowFilter?: string;
  endpointMarkerGlowFilter?: string;
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
}

interface RadialArcPathEndpointMarksPropsWithColor extends RadialArcPathEndpointMarksPropsBase {
  color: string;
}

interface RadialArcPathEndpointMarksPropsWithGradient extends RadialArcPathEndpointMarksPropsBase {
  gradient: GradientStop[];
}

export type RadialArcPathEndpointMarksProps =
  | RadialArcPathEndpointMarksPropsWithColor
  | RadialArcPathEndpointMarksPropsWithGradient;

const ENDPOINT_MARKER_MIN_ANGLE = 10;
const DOT_OPACITY = 0.5;
const DOT_RADIUS_FACTOR = 0.4;
const MAX_DOT_RADIUS = 8;

export function RadialArcPathEndpointMarks({
  startAngle: angle,
  arcLengthDeg,
  dimensions,
  endpointMarker,
  fieldDisplay,
  xStart,
  xEnd,
  yStart,
  yEnd,
  roundedBars,
  endpointMarkerGlowFilter,
  glowFilter,
  ...rest
}: RadialArcPathEndpointMarksProps) {
  const isGradient = 'gradient' in rest;
  const { radius, centerX, centerY, barWidth } = dimensions;
  const endRadians = toRad(angle + arcLengthDeg);

  switch (endpointMarker) {
    case 'point': {
      const [pointColorStart, pointColorEnd] = isGradient
        ? getEndpointMarkerColors(rest.gradient, fieldDisplay.display.percent)
        : [getGuideDotColor(rest.color), getGuideDotColor(rest.color)];

      const dotRadius =
        endpointMarker === 'point' ? Math.min((barWidth / 2) * DOT_RADIUS_FACTOR, MAX_DOT_RADIUS) : barWidth / 2;

      return (
        <>
          {arcLengthDeg > ENDPOINT_MARKER_MIN_ANGLE && (
            <circle cx={xStart} cy={yStart} r={dotRadius} fill={pointColorStart} opacity={DOT_OPACITY} />
          )}
          <circle cx={xEnd} cy={yEnd} r={dotRadius} fill={pointColorEnd} opacity={DOT_OPACITY} />
        </>
      );
    }
    case 'glow':
      const offsetAngle = toRad(ENDPOINT_MARKER_MIN_ANGLE);
      const xStartMark = centerX + radius * Math.cos(endRadians + offsetAngle);
      const yStartMark = centerY + radius * Math.sin(endRadians + offsetAngle);
      if (arcLengthDeg <= ENDPOINT_MARKER_MIN_ANGLE) {
        break;
      }
      return (
        <path
          d={['M', xStartMark, yStartMark, 'A', radius, radius, 0, 0, 1, xEnd, yEnd].join(' ')}
          fill="none"
          strokeWidth={barWidth}
          stroke={endpointMarkerGlowFilter}
          strokeLinecap={roundedBars ? 'round' : 'butt'}
          filter={glowFilter}
        />
      );
    default:
      break;
  }

  return null;
}
