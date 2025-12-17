import { useId, memo, HTMLAttributes } from 'react';

import { FieldDisplay } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';

import { buildGradientColors, getEndpointColors, getGradientCss, getGuideDotColors } from './colors';
import { RadialGradientMode, RadialShape, RadialGaugeDimensions } from './types';
import { drawRadialArcPath, toRad } from './utils';

export interface RadialArcPathPropsBase {
  arcLengthDeg: number;
  color?: string;
  dimensions: RadialGaugeDimensions;
  fieldDisplay: FieldDisplay;
  glowFilter?: string;
  gradientMode: RadialGradientMode;
  roundedBars?: boolean;
  shape: RadialShape;
  showGuideDots?: boolean;
  startAngle: number;
}

interface RadialArcPathPropsWithGuideDot extends RadialArcPathPropsBase {
  showGuideDots: true;
  guideDotStartColor: string;
  guideDotEndColor: string;
}

type RadialArcPathProps = RadialArcPathPropsBase | RadialArcPathPropsWithGuideDot;

const DOT_OPACITY = 0.5;
const DOT_RADIUS_FACTOR = 0.4;
const MAX_DOT_RADIUS = 8;

export const RadialArcPath = memo(
  ({
    arcLengthDeg,
    color,
    dimensions,
    fieldDisplay,
    glowFilter,
    gradientMode,
    roundedBars,
    shape,
    showGuideDots,
    startAngle: angle,
  }: RadialArcPathProps) => {
    const theme = useTheme2();
    const id = useId();

    const gradientStops = buildGradientColors(gradientMode, theme, fieldDisplay, fieldDisplay.display.color);

    let guideDotColors: [string, string] | undefined;
    let endpointColors: [string, string] | undefined;

    if (showGuideDots && gradientStops.length > 0) {
      guideDotColors = getGuideDotColors(gradientStops, fieldDisplay.display.percent);
      if (shape === 'circle') {
        endpointColors = getEndpointColors(gradientStops, fieldDisplay.display.percent);
      }
    }

    const bgDivStyle: HTMLAttributes<HTMLDivElement>['style'] = { width: '100%', height: '100%' };
    if (color) {
      bgDivStyle.backgroundColor = color;
    } else {
      bgDivStyle.backgroundImage = getGradientCss(gradientStops, shape);
    }

    const { radius, centerX, centerY, barWidth } = dimensions;

    const path = drawRadialArcPath(angle, arcLengthDeg, dimensions, roundedBars);

    const startRadians = toRad(angle);
    const endRadians = toRad(angle + arcLengthDeg);

    const x1 = centerX + radius * Math.cos(startRadians);
    const y1 = centerY + radius * Math.sin(startRadians);
    const x2 = centerX + radius * Math.cos(endRadians);
    const y2 = centerY + radius * Math.sin(endRadians);

    const dotRadius = Math.min((barWidth / 2) * DOT_RADIUS_FACTOR, MAX_DOT_RADIUS);

    return (
      <>
        {/* FIXME: optimize this by only using clippath + foreign obj for gradients */}
        <clipPath id={id}>
          <path d={path} />
        </clipPath>

        <g filter={glowFilter}>
          <foreignObject
            x={centerX - radius - barWidth}
            y={centerY - radius - barWidth}
            width={(radius + barWidth) * 2}
            height={(radius + barWidth) * 2}
            clipPath={`url(#${id})`}
          >
            <div style={bgDivStyle} />
          </foreignObject>
          {endpointColors && <circle cx={x1} cy={y1} r={barWidth / 2} fill={endpointColors[0]} />}
          {endpointColors && <circle cx={x2} cy={y2} r={barWidth / 2} fill={endpointColors[1]} />}
        </g>

        {guideDotColors && arcLengthDeg > 5 && (
          <circle cx={x1} cy={y1} r={dotRadius} fill={guideDotColors[0]} opacity={DOT_OPACITY} />
        )}
        {guideDotColors && <circle cx={x2} cy={y2} r={dotRadius} fill={guideDotColors[1]} opacity={DOT_OPACITY} />}
      </>
    );
  }
);

RadialArcPath.displayName = 'RadialArcPath';
