import { HTMLAttributes, memo, useId, useMemo } from 'react';

import { FieldDisplay } from '@grafana/data';

import { RadialArcPathEndpointMarks } from './RadialArcPathEndpointMarks';
import { getBarEndcapColors, getGradientCss } from './colors';
import { ARC_END, ARC_START } from './constants';
import { RadialShape, RadialGaugeDimensions, GradientStop } from './types';
import { drawRadialArcPath, toRad, IS_SAFARI } from './utils';

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
    glowFilter: rawGlowFilter,
    endpointMarkerGlowFilter,
    ...rest
  }: RadialArcPathProps) => {
    const id = useId();

    const { radius, centerX, centerY, barWidth, vizHeight, vizWidth } = dimensions;
    const boxX = Math.round(centerX - radius - barWidth);
    const boxY = Math.round(centerY - radius - barWidth);
    const boxSize = Math.ceil((radius + barWidth) * 2);

    const path = useMemo(() => drawRadialArcPath(angle, arcLengthDeg, radius), [angle, arcLengthDeg, radius]);

    const startRadians = toRad(angle);
    const endRadians = toRad(angle + arcLengthDeg);

    const xStart = centerX + radius * Math.cos(startRadians);
    const yStart = centerY + radius * Math.sin(startRadians);
    const xEnd = centerX + radius * Math.cos(endRadians);
    const yEnd = centerY + radius * Math.sin(endRadians);

    const isGradient = 'gradient' in rest;
    const bgDivStyle: HTMLAttributes<HTMLDivElement>['style'] = {
      width: boxSize,
      height: boxSize,
    };

    if (isGradient) {
      let roundedEndcapAngle = 0;
      // "over-rotate" the gradient in both directions for rounded bars on gauge, since the rounded endcaps extend beyond the path
      if (shape === 'gauge' && roundedBars) {
        roundedEndcapAngle = (barWidth / (Math.PI * boxSize)) * 360;
      }
      const vizStartAngle = shape === 'circle' ? 0 : ARC_START;
      const vizEndAngle = shape === 'circle' ? 360 : ARC_END;
      bgDivStyle.backgroundImage = getGradientCss(
        rest.gradient,
        vizStartAngle - roundedEndcapAngle,
        vizEndAngle + roundedEndcapAngle
      );
    } else {
      bgDivStyle.backgroundColor = rest.color;
    }

    let barEndcapColors: [string, string] | undefined;
    if (barEndcaps) {
      if (isGradient) {
        barEndcapColors = getBarEndcapColors(rest.gradient, fieldDisplay.display.percent);
      } else {
        barEndcapColors = [rest.color, rest.color];
      }
    }

    // in Safari, applying the glow to the group causes a bug where the gradient appears clipped, so we skip the glow in that browser.
    const glowFilter = IS_SAFARI && isGradient ? undefined : rawGlowFilter;

    const pathEl = (
      <path
        d={path}
        transform={`translate(${centerX}, ${centerY})`}
        strokeWidth={barWidth}
        strokeLinecap={roundedBars ? 'round' : 'butt'}
        fill="none"
        stroke={isGradient ? 'white' : rest.color}
      />
    );

    const vizContent = (
      <>
        {isGradient ? (
          <foreignObject x={boxX} y={Math.max(boxY, 0)} width={vizWidth} height={vizHeight} mask={`url(#${id})`}>
            <div style={bgDivStyle} />
          </foreignObject>
        ) : (
          pathEl
        )}
        {barEndcapColors?.[0] && <circle cx={xStart} cy={yStart} r={barWidth / 2} fill={barEndcapColors[0]} />}
        {barEndcapColors?.[1] && <circle cx={xEnd} cy={yEnd} r={barWidth / 2} fill={barEndcapColors[1]} />}
      </>
    );

    return (
      <>
        {isGradient && (
          <defs>
            <mask id={id} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
              <rect x={0} y={0} width={vizWidth} height={vizHeight} fill="black" />
              {pathEl}
            </mask>
          </defs>
        )}

        {glowFilter ? <g filter={glowFilter}>{vizContent}</g> : vizContent}

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
