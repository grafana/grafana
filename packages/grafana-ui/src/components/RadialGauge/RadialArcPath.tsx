import { useId, memo, HTMLAttributes, ReactNode, SVGProps } from 'react';

import { FieldDisplay } from '@grafana/data';

import { getBarEndcapColors, getGradientCss, getEndpointMarkerColors, getGuideDotColor } from './colors';
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

    const isGradient = 'gradient' in rest;

    const { vizWidth, vizHeight, radius, centerX, centerY, barWidth } = dimensions;
    const pad = Math.ceil(Math.max(2, barWidth / 2)); // pad to cover stroke caps and glow in Safari
    const boxX = Math.round(centerX - radius - barWidth - pad);
    const boxY = Math.round(centerY - radius - barWidth - pad);
    const boxSize = Math.round((radius + barWidth) * 2 + pad * 2);

    const path = drawRadialArcPath(angle, arcLengthDeg, dimensions, roundedBars);

    const startRadians = toRad(angle);
    const endRadians = toRad(angle + arcLengthDeg);

    const xStart = centerX + radius * Math.cos(startRadians);
    const yStart = centerY + radius * Math.sin(startRadians);
    const xEnd = centerX + radius * Math.cos(endRadians);
    const yEnd = centerY + radius * Math.sin(endRadians);

    const bgDivStyle: HTMLAttributes<HTMLDivElement>['style'] = { width: boxSize, height: vizHeight, marginLeft: boxX };
    const pathProps: SVGProps<SVGPathElement> = {};
    if (isGradient) {
      bgDivStyle.backgroundImage = getGradientCss(rest.gradient, shape);
      pathProps.fill = 'none';
      pathProps.stroke = 'white';
    } else {
      bgDivStyle.backgroundColor = rest.color;
      pathProps.fill = 'none';
      pathProps.stroke = rest.color;
    }

    let barEndcapColors: [string, string] | undefined;
    if (barEndcaps) {
      barEndcapColors = isGradient
        ? getBarEndcapColors(rest.gradient, fieldDisplay.display.percent)
        : [rest.color, rest.color];
    }

    let endpointMarks: ReactNode = null;
    switch (endpointMarker) {
      case 'point': {
        const [pointColorStart, pointColorEnd] = isGradient
          ? getEndpointMarkerColors(rest.gradient, fieldDisplay.display.percent)
          : [getGuideDotColor(rest.color), getGuideDotColor(rest.color)];

        const dotRadius =
          endpointMarker === 'point' ? Math.min((barWidth / 2) * DOT_RADIUS_FACTOR, MAX_DOT_RADIUS) : barWidth / 2;

        endpointMarks = (
          <>
            {arcLengthDeg > ENDPOINT_MARKER_MIN_ANGLE && (
              <circle cx={xStart} cy={yStart} r={dotRadius} fill={pointColorStart} opacity={DOT_OPACITY} />
            )}
            <circle cx={xEnd} cy={yEnd} r={dotRadius} fill={pointColorEnd} opacity={DOT_OPACITY} />
          </>
        );
        break;
      }
      case 'glow':
        const offsetAngle = toRad(ENDPOINT_MARKER_MIN_ANGLE);
        const xStartMark = centerX + radius * Math.cos(endRadians + offsetAngle);
        const yStartMark = centerY + radius * Math.sin(endRadians + offsetAngle);
        if (arcLengthDeg <= ENDPOINT_MARKER_MIN_ANGLE) {
          break;
        }
        endpointMarks = (
          <path
            d={['M', xStartMark, yStartMark, 'A', radius, radius, 0, 0, 1, xEnd, yEnd].join(' ')}
            fill="none"
            strokeWidth={barWidth}
            stroke={endpointMarkerGlowFilter}
            strokeLinecap={roundedBars ? 'round' : 'butt'}
            filter={glowFilter}
          />
        );
        break;
      default:
        break;
    }

    const pathEl = (
      <path d={path} strokeWidth={barWidth} strokeLinecap={roundedBars ? 'round' : 'butt'} {...pathProps} />
    );

    return (
      <>
        {isGradient && (
          <defs>
            <mask id={id} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
              <rect x={boxX} y={boxY} width={boxSize} height={boxSize} fill="black" />
              {pathEl}
            </mask>
          </defs>
        )}

        <g filter={glowFilter}>
          {isGradient ? (
            <foreignObject x={0} y={0} width={vizWidth} height={vizHeight} mask={`url(#${id})`}>
              <div style={bgDivStyle} />
            </foreignObject>
          ) : (
            pathEl
          )}
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
