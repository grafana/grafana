import { useId, useMemo, memo } from 'react';

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

    const gradientStops = useMemo(() => {
      if (gradientMode === 'none') {
        return [];
      }
      return buildGradientColors(gradientMode, theme, fieldDisplay, fieldDisplay.display.color);
    }, [gradientMode, fieldDisplay, theme]);

    const { guideDotColors, endpointColors } = useMemo(() => {
      if (!showGuideDots || gradientStops.length === 0) {
        return {
          guideDotStartColor: undefined,
          guideDotEndColor: undefined,
        };
      }
      return {
        guideDotColors: getGuideDotColors(gradientStops, fieldDisplay.display.percent ?? 0),
        endpointColors:
          shape === 'circle' ? getEndpointColors(gradientStops, fieldDisplay.display.percent ?? 1) : undefined,
      };
    }, [showGuideDots, fieldDisplay, gradientStops, shape]);

    const bgDivStyle = useMemo(() => {
      const baseStyles = { width: '100%', height: '100%' };
      if (color) {
        return { backgroundColor: color, ...baseStyles };
      }
      const gradientCss = getGradientCss(gradientStops, shape);
      return { backgroundImage: gradientCss, ...baseStyles };
    }, [color, gradientStops, shape]);

    const { radius, centerX, centerY, barWidth } = dimensions;

    const path = useMemo(
      () => drawRadialArcPath(angle, arcLengthDeg, dimensions, roundedBars),
      [angle, arcLengthDeg, dimensions, roundedBars]
    );

    const { x1, x2, y1, y2 } = useMemo(() => {
      const startRadians = toRad(angle);
      const endRadians = toRad(angle + arcLengthDeg);

      let x1 = centerX + radius * Math.cos(startRadians);
      let y1 = centerY + radius * Math.sin(startRadians);
      let x2 = centerX + radius * Math.cos(endRadians);
      let y2 = centerY + radius * Math.sin(endRadians);
      return { x1, y1, x2, y2 };
    }, [angle, arcLengthDeg, centerX, centerY, radius]);

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

        {guideDotColors && arcLengthDeg > 5 && <circle cx={x1} cy={y1} r={dotRadius} fill={guideDotColors[0]} />}
        {guideDotColors && <circle cx={x2} cy={y2} r={dotRadius} fill={guideDotColors[1]} />}
      </>
    );
  }
);

RadialArcPath.displayName = 'RadialArcPath';
