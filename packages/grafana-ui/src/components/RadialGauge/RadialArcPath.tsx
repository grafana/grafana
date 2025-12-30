import { useId, memo, HTMLAttributes, ReactNode } from 'react';

import { FieldDisplay } from '@grafana/data';

import { getBarEndcapColors, getGradientCss, getEndpointMarkerColors } from './colors';
import { RadialShape, RadialGaugeDimensions, GradientStop } from './types';
import { drawRadialArcPath, toRad } from './utils';

export interface RadialArcPathPropsBase {
  arcLengthDeg: number;
  barEndcaps?: boolean;
  dimensions: RadialGaugeDimensions;
  fieldDisplay: FieldDisplay;
  roundedBars?: boolean;
  shape: RadialShape;
  endpointMarker?: 'point' | 'glow';
  startAngle: number;
  glowFilter?: string;
  endpointMarkerGlowFilter?: string;
}

interface RadialArcPathPropsWithColor extends RadialArcPathPropsBase {
  color: string;
}

interface RadialArcPathPropsWithGradient extends RadialArcPathPropsBase {
  gradient: GradientStop[];
}

type RadialArcPathProps = RadialArcPathPropsWithColor | RadialArcPathPropsWithGradient;

const ENDPOINT_MARKER_MIN_ANGLE = 10;
const DOT_OPACITY = 0.5;
const DOT_RADIUS_FACTOR = 0.4;
const MAX_DOT_RADIUS = 8;

export const RadialArcPath = memo(
  ({
    arcLengthDeg,
    dimensions,
    fieldDisplay,
    roundedBars,
    shape,
    endpointMarker,
    barEndcaps,
    startAngle: angle,
    glowFilter,
    endpointMarkerGlowFilter,
    ...rest
  }: RadialArcPathProps) => {
    const id = useId();

    const bgDivStyle: HTMLAttributes<HTMLDivElement>['style'] = { width: '100%', height: '100%' };
    if ('color' in rest) {
      bgDivStyle.backgroundColor = rest.color;
    } else {
      bgDivStyle.backgroundImage = getGradientCss(rest.gradient, shape);
    }

    const { radius, centerX, centerY, barWidth } = dimensions;

    const path = drawRadialArcPath(angle, arcLengthDeg, dimensions, roundedBars);

    const startRadians = toRad(angle);
    const endRadians = toRad(angle + arcLengthDeg);

    const xStart = centerX + radius * Math.cos(startRadians);
    const yStart = centerY + radius * Math.sin(startRadians);
    const xEnd = centerX + radius * Math.cos(endRadians);
    const yEnd = centerY + radius * Math.sin(endRadians);

    const dotRadius =
      endpointMarker === 'point' ? Math.min((barWidth / 2) * DOT_RADIUS_FACTOR, MAX_DOT_RADIUS) : barWidth / 2;

    let barEndcapColors: [string, string] | undefined;
    let endpointMarks: ReactNode = null;
    if ('gradient' in rest) {
      if (endpointMarker && (rest.gradient?.length ?? 0) > 0) {
        switch (endpointMarker) {
          case 'point':
            const [pointColorStart, pointColorEnd] = getEndpointMarkerColors(
              rest.gradient!,
              fieldDisplay.display.percent
            );
            endpointMarks = (
              <>
                {arcLengthDeg > ENDPOINT_MARKER_MIN_ANGLE && (
                  <circle cx={xStart} cy={yStart} r={dotRadius} fill={pointColorStart} opacity={DOT_OPACITY} />
                )}
                <circle cx={xEnd} cy={yEnd} r={dotRadius} fill={pointColorEnd} opacity={DOT_OPACITY} />
              </>
            );
            break;
          case 'glow':
            const offsetAngle = toRad(ENDPOINT_MARKER_MIN_ANGLE);
            const xStartMark = centerX + radius * Math.cos(endRadians + offsetAngle);
            const yStartMark = centerY + radius * Math.sin(endRadians + offsetAngle);
            endpointMarks =
              arcLengthDeg > ENDPOINT_MARKER_MIN_ANGLE ? (
                <path
                  d={['M', xStartMark, yStartMark, 'A', radius, radius, 0, 0, 1, xEnd, yEnd].join(' ')}
                  fill="none"
                  strokeWidth={barWidth}
                  stroke={endpointMarkerGlowFilter}
                  strokeLinecap={roundedBars ? 'round' : 'butt'}
                  filter={glowFilter}
                />
              ) : null;
            break;
          default:
            break;
        }
      }

      if (barEndcaps) {
        barEndcapColors = getBarEndcapColors(rest.gradient, fieldDisplay.display.percent);
      }
    }

    return (
      <>
        {/* FIXME: optimize this by only using clippath + foreign obj for gradients */}
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse">
            <rect
              x={centerX - radius - barWidth}
              y={centerY - radius - barWidth}
              width={(radius + barWidth) * 2}
              height={(radius + barWidth) * 2}
              fill="black"
            />
            <path
              d={path}
              fill="none"
              stroke="white"
              strokeWidth={barWidth}
              strokeLinecap={roundedBars ? 'round' : 'butt'}
            />
          </mask>
        </defs>

        <g filter={glowFilter}>
          <foreignObject
            x={centerX - radius - barWidth}
            y={centerY - radius - barWidth}
            width={(radius + barWidth) * 2}
            height={(radius + barWidth) * 2}
            mask={`url(#${id})`}
          >
            <div style={bgDivStyle} />
          </foreignObject>
          {barEndcapColors?.[0] && <circle cx={xStart} cy={yStart} r={barWidth / 2} fill={barEndcapColors[0]} />}
          {barEndcapColors?.[1] && (
            <circle cx={xEnd} cy={yEnd} r={barWidth / 2} fill={barEndcapColors[1]} opacity={0.5} />
          )}
        </g>

        {endpointMarks}
      </>
    );
  }
);

RadialArcPath.displayName = 'RadialArcPath';
