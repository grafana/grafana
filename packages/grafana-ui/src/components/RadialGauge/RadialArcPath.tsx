import { omit } from 'lodash';
import { useId, memo, HTMLAttributes, SVGProps } from 'react';

import { FieldDisplay } from '@grafana/data';

import { RadialArcPathEndpointMarks } from './RadialArcPathEndpointMarks';
import { getBarEndcapColors, getGradientCss } from './colors';
import { RadialShape, RadialGaugeDimensions, GradientStop } from './types';
import { drawRadialArcPath, toRad, IS_SAFARI } from './utils';

export interface RadialArcPathPropsBase extends SVGProps<SVGGElement> {
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
    const boxX = Math.round(centerX - radius - barWidth);
    const boxY = Math.round(centerY - radius - barWidth);
    const boxSize = (radius + barWidth) * 2;

    const path = drawRadialArcPath(angle, arcLengthDeg, dimensions);

    const startRadians = toRad(angle);
    const endRadians = toRad(angle + arcLengthDeg);

    const xStart = centerX + radius * Math.cos(startRadians);
    const yStart = centerY + radius * Math.sin(startRadians);
    const xEnd = centerX + radius * Math.cos(endRadians);
    const yEnd = centerY + radius * Math.sin(endRadians);

    const bgDivStyle: HTMLAttributes<HTMLDivElement>['style'] = {
      width: boxSize,
      height: boxSize,
    };

    const pathProps: SVGProps<SVGPathElement> = {};
    if (isGradient) {
      let roundedBarOffset: number | undefined;
      // "over-rotate" the gradient in both directions for rounded bars on gauge, since the rounded endcaps extend beyond the path
      if (shape === 'gauge' && roundedBars) {
        roundedBarOffset = (barWidth / (2 * Math.PI * radius)) * 360;
      }
      bgDivStyle.backgroundImage = getGradientCss(rest.gradient, shape, roundedBarOffset);
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

        {/* the gradient color can unexpectedly be cut off in Safari when glowFilters are active at certain sizes of the circular gauge */}
        <g
          transform="translate(0, 0)"
          filter={IS_SAFARI && isGradient && shape === 'circle' ? undefined : glowFilter}
          {...omit(rest, 'color', 'gradient')}
        >
          {isGradient ? (
            <foreignObject
              transform="translate(0, 0)"
              x={Math.max(boxX, 0)}
              y={Math.max(boxY, 0)}
              width={vizWidth}
              height={vizHeight}
              mask={`url(#${id})`}
            >
              <div style={bgDivStyle} />
            </foreignObject>
          ) : (
            pathEl
          )}
          {barEndcapColors?.[0] && <circle cx={xStart} cy={yStart} r={barWidth / 2} fill={barEndcapColors[0]} />}
          {barEndcapColors?.[1] && <circle cx={xEnd} cy={yEnd} r={barWidth / 2} fill={barEndcapColors[1]} />}
        </g>

        {endpointMarker && (
          <RadialArcPathEndpointMarks
            startAngle={angle}
            arcLengthDeg={arcLengthDeg}
            dimensions={dimensions}
            endpointMarker={endpointMarker}
            fieldDisplay={fieldDisplay}
            xStart={xStart}
            xEnd={xEnd}
            yStart={yStart}
            yEnd={yEnd}
            roundedBars={roundedBars}
            endpointMarkerGlowFilter={endpointMarkerGlowFilter}
            glowFilter={glowFilter}
            {...rest}
          />
        )}
      </>
    );
  }
);

RadialArcPath.displayName = 'RadialArcPath';
