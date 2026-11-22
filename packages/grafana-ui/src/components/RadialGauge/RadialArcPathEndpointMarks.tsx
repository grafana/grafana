import { memo } from 'react';

import { type FieldDisplay } from '@grafana/data';

import { getEndpointMarkerColors, getGuideDotColor } from './colors';
import { type GradientStop, type RadialGaugeDimensions } from './types';
import { toRad } from './utils';

interface RadialArcPathEndpointMarksPropsBase {
  arcLengthDeg: number;
  dimensions: RadialGaugeDimensions;
  fieldDisplay: FieldDisplay;
  endpointMarker: 'point' | 'glow';
  /** Value sits at the start of the arc, so the marker belongs there rather than at the clockwise end. */
  markerAtStart?: boolean;
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

export const RadialArcPathEndpointMarks = memo(
  ({
    startAngle: angle,
    arcLengthDeg,
    dimensions,
    endpointMarker,
    markerAtStart = false,
    fieldDisplay,
    xStart,
    xEnd,
    yStart,
    yEnd,
    roundedBars,
    endpointMarkerGlowFilter,
    glowFilter,
    ...rest
  }: RadialArcPathEndpointMarksProps) => {
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

        const tipX = markerAtStart ? xStart : xEnd;
        const tipY = markerAtStart ? yStart : yEnd;
        const otherX = markerAtStart ? xEnd : xStart;
        const otherY = markerAtStart ? yEnd : yStart;
        const tipColor = pointColorEnd;
        const otherColor = pointColorStart;

        return (
          <>
            {arcLengthDeg > ENDPOINT_MARKER_MIN_ANGLE && (
              <circle cx={otherX} cy={otherY} r={dotRadius} fill={otherColor} opacity={DOT_OPACITY} />
            )}
            <circle cx={tipX} cy={tipY} r={dotRadius} fill={tipColor} opacity={DOT_OPACITY} />
          </>
        );
      }
      case 'glow':
        if (arcLengthDeg <= ENDPOINT_MARKER_MIN_ANGLE) {
          return null;
        }
        // toRad also rotates by -90° so the gauge's 0° points up. An offset must not use that rotation.
        const offsetAngle = (ENDPOINT_MARKER_MIN_ANGLE * Math.PI) / 180;
        const tipRadians = markerAtStart ? toRad(angle) : endRadians;
        const outerRadians = markerAtStart ? tipRadians - offsetAngle : tipRadians + offsetAngle;
        const xOuter = centerX + radius * Math.cos(outerRadians);
        const yOuter = centerY + radius * Math.sin(outerRadians);
        const xTip = markerAtStart ? xStart : xEnd;
        const yTip = markerAtStart ? yStart : yEnd;
        // The outer point sits 10° beyond the tip, away from the bar. The short arc back
        // to the value is clockwise for the start tip and counterclockwise for the end tip.
        const sweepFlag = markerAtStart ? 1 : 0;
        return (
          <path
            d={`M ${xOuter} ${yOuter} A ${radius} ${radius} 0 0 ${sweepFlag} ${xTip} ${yTip}`}
            fill="none"
            strokeWidth={barWidth}
            stroke={endpointMarkerGlowFilter}
            strokeLinecap="round"
            filter={glowFilter}
          />
        );
      default:
        break;
    }

    return null;
  }
);

RadialArcPathEndpointMarks.displayName = 'RadialArcPathEndpointMarks';
